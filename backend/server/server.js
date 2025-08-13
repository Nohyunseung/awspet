require('dotenv').config()
console.log('[boot] server.js loaded')
process.on('beforeExit', (code) => console.log('[lifecycle] beforeExit', code))
process.on('exit', (code) => console.log('[lifecycle] exit', code))
process.on('uncaughtException', (err) => { console.error('[lifecycle] uncaughtException', err); process.exit(1) })
process.on('unhandledRejection', (reason) => { console.error('[lifecycle] unhandledRejection', reason) })
const express = require('express')
const http = require('node:http')
const socketIo = require('socket.io')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { connectMongo } = require('./db/mongo')
const Conversation = require('./models/Conversation')
const Message = require('./models/Message')

// 라우터 import (최소 기능용 DB 직접 사용)
const {
  testConnection,
  findUserByEmail,
  createUser,
  createDog,
  getDogsByUserId,
  deleteDogByIdOwner,
  createSitterPosting,
  getAllSitters,
  getSitterByUserId,
  getBookingsByOwnerId,
  getBookingsBySitterId,
  createBooking,
  createJobPosting,
  getAllActiveOwnerJobs,
  updateJobPostingStatus,
} = require('./config/database-minimal')

const app = express()
console.log('[boot] express created')
const server = http.createServer(app)

// CORS 설정
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}))

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// AWS 클라이언트 설정
const REGION = process.env.AWS_REGION || 'ap-northeast-2'
const MESSAGES_TABLE = process.env.MESSAGES_TABLE || 'PetBuddyMessages'
const s3Bucket = process.env.S3_BUCKET || 'pet-buddy-uploads'

const s3 = new S3Client({ region: REGION })

// 로컬 캐시(선택): 최근 대화방 메시지 캐시 (Mongo로 이전해도 핫 캐시로 유지 가능)
const messageHistory = new Map()
const activeUsers = new Map()

app.use(express.json({ limit: '10mb' }))

// === 최소 기능 Auth ===
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  try {
    if (!email || !password) return res.status(400).json({ success: false, message: '이메일/비밀번호 필요' })
    const user = await findUserByEmail(email)
    if (!user) return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' })

    const stored = user.password_hash ?? user.password ?? ''
    let isMatch = false
    try {
      // bcrypt 해시 형태면 비교, 아니면 문자열 비교
      if (typeof stored === 'string' && stored.startsWith('$2')) {
        isMatch = await bcrypt.compare(String(password), stored)
      } else {
        isMatch = String(stored) === String(password)
      }
    } catch (_) {
      isMatch = String(stored) === String(password)
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: '비밀번호 불일치' })
    }

    return res.json({ success: true, data: { user: { id: user.id || user.user_id, email: user.email, fullName: user.full_name || user.email.split('@')[0], phone: user.phone || user.phone_number }, token: 'dev-token' } })
  } catch (e) {
    console.error('login error', e)
    res.status(500).json({ success: false, message: '로그인 실패' })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const { email, password, phone_number } = req.body || {}
  try {
    if (!email || !password) return res.status(400).json({ success: false, message: '이메일/비밀번호 필요' })
    const exist = await findUserByEmail(email)
    if (exist) return res.status(400).json({ success: false, message: '이미 존재하는 이메일입니다.' })
    // DB 스키마에 따라 password_hash 또는 password 컬럼로 저장됩니다
    const result = await createUser({ email, password_hash: password, phone_number: phone_number || null })
    return res.json({ success: true, data: { user: { id: result.userId, email, fullName: email.split('@')[0], phone: phone_number || null }, token: 'dev-token' } })
  } catch (e) {
    console.error('register error', e)
    res.status(500).json({ success: false, message: e?.message || '회원가입 실패' })
  }
})

// === Dogs ===
app.get('/api/dogs/user/:userId', async (req, res) => {
  try {
    const dogs = await getDogsByUserId(req.params.userId)
    res.json({ success: true, dogs })
  } catch (e) {
    console.error('dogs list error', e)
    res.status(500).json({ success: false, message: '강아지 조회 실패' })
  }
})

app.post('/api/dogs', async (req, res) => {
  const { user_id, name, profile_image_url, breed, personality, birth_date, special_notes } = req.body || {}
  if (!user_id || !name) {
    return res.status(400).json({ success: false, message: '필수 필드 누락 (user_id, name)' })
  }
  try {
    console.log('🐶 create dog payload:', { user_id, name, breed, personality, birth_date, special_notes, profile_image_url })
    const result = await createDog({ user_id, name, profile_image_url, breed, personality, birth_date, special_notes })
    res.json({ success: true, dog: { id: result.dogId, user_id, name, profile_image_url, breed, personality, birth_date, special_notes } })
  } catch (e) {
    console.error('dog create error', e)
    res.status(500).json({ success: false, message: e?.message || '반려견 등록 실패' })
  }
})

app.delete('/api/dogs/:dogId', async (req, res) => {
  const { dogId } = req.params
  const { user_id } = req.query
  if (!dogId || !user_id) return res.status(400).json({ success: false, message: '필수 필드 누락 (dogId, user_id)' })
  try {
    const result = await deleteDogByIdOwner(dogId, String(user_id))
    if (result.success) return res.json({ success: true })
    return res.status(404).json({ success: false, message: '대상 없음' })
  } catch (e) {
    console.error('dog delete error', e)
    res.status(500).json({ success: false, message: '반려견 삭제 실패' })
  }
})

// === Sitter postings ===
app.get('/api/sitter-postings', async (_req, res) => {
  try {
    // 활성 공고만 반환
    const [rows] = await require('mysql2/promise').createPool(require('./config/database-minimal').dbConfig)
      .execute(`SELECT * FROM sitter_postings WHERE status = 'active' ORDER BY created_at DESC`)
    res.json({ success: true, posts: rows })
  } catch (e) {
    console.error('sitter postings list error', e)
    res.status(500).json({ success: false, message: '시터 공고 목록 조회 실패' })
  }
})

// 시터 공고 비활성화(예약 후 숨김)
app.post('/api/sitter-postings/:postId/close', async (req, res) => {
  const { postId } = req.params
  try {
    const pool = require('mysql2/promise').createPool(require('./config/database-minimal').dbConfig)
    const [result] = await pool.execute(`UPDATE sitter_postings SET status='closed' WHERE post_id = ?`, [postId])
    return res.json({ success: (result.affectedRows ?? 0) > 0 })
  } catch (e) {
    console.error('sitter posting close error', e)
    res.status(500).json({ success: false, message: '시터 공고 상태 변경 실패' })
  }
})

// === Owner jobs ===
app.get('/api/jobs', async (_req, res) => {
  try {
    const jobs = await getAllActiveOwnerJobs()
    res.json({ success: true, jobs })
  } catch (e) {
    console.error('jobs list error', e)
    res.status(500).json({ success: false, message: '공고 목록 조회 실패' })
  }
})

app.post('/api/jobs', async (req, res) => {
  const { owner_id, dog_id, title, description, location, start_date, end_date, status } = req.body || {}
  if (!owner_id || !dog_id || !title || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: '필수 필드 누락 (owner_id, dog_id, title, start_date, end_date)' })
  }
  try {
    const result = await createJobPosting({ owner_id, dog_id, title, description, location, start_date, end_date, status })
    res.json({ success: true, job_id: result.jobId })
  } catch (e) {
    console.error('job create error', e)
    res.status(500).json({ success: false, message: '공고 생성 실패' })
  }
})

app.delete('/api/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params
  try {
    const result = await updateJobPostingStatus(jobId, 'closed')
    if (result.success) return res.json({ success: true })
    return res.status(404).json({ success: false, message: '대상 없음' })
  } catch (e) {
    console.error('job delete error', e)
    res.status(500).json({ success: false, message: '공고 취소 실패' })
  }
})
app.post('/api/sitter-postings', async (req, res) => {
  const { sitter_id, title, description, location, available_from, available_to, status } = req.body || {}
  if (!sitter_id || !title || !available_from || !available_to) {
    return res.status(400).json({ success: false, message: '필수 필드 누락 (sitter_id, title, available_from, available_to)' })
  }
  try {
    const result = await createSitterPosting({ sitter_id, title, description, location, available_from, available_to, status })
    res.json({ success: true, post_id: result.postId })
  } catch (e) {
    console.error('sitter posting create error', e)
    res.status(500).json({ success: false, message: e?.message || '시터 공고 생성 실패' })
  }
})

// 기본 엔드포인트
app.get('/', (req, res) => {
  res.json({ 
    message: 'Pet Buddy Server is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      dogs: '/api/dogs',
      bookings: '/api/bookings',
      sitters: '/api/sitters',
      chat: '/api/conversations'
    }
  })
})

// === Bookings ===
// 견주 예약 목록 조회 (가까운 시간 순)
app.get('/api/bookings/owner/:ownerId', async (req, res) => {
  try {
    const rows = await getBookingsByOwnerId(String(req.params.ownerId))
    // 정렬 보장 (DB 정렬 실패 대비)
    const sorted = [...(rows || [])].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    res.json({ success: true, bookings: sorted })
  } catch (e) {
    console.error('bookings list error', e)
    res.status(500).json({ success: false, message: '예약 목록 조회 실패' })
  }
})

// 예약 생성 (시터 공고 기준으로 생성 가능)
app.post('/api/bookings', async (req, res) => {
  const { owner_id, sitter_id, dog_id, start_time, end_time, source_post_id } = req.body || {}
  if (!owner_id || !sitter_id || !dog_id || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: '필수 필드 누락 (owner_id, sitter_id, dog_id, start_time, end_time)' })
  }
  try {
    console.log('📦 booking payload:', { owner_id, sitter_id, dog_id, start_time, end_time, source_post_id })
    let location = undefined
    if (source_post_id) {
      try {
        const pool = require('mysql2/promise').createPool(require('./config/database-minimal').dbConfig)
        const [rows] = await pool.execute(`SELECT location FROM sitter_postings WHERE post_id = ? LIMIT 1`, [source_post_id])
        location = rows?.[0]?.location || undefined
      } catch {}
    }
    const result = await createBooking({ owner_id, sitter_id, dog_id, start_time, end_time, location })
    // 예약 성공 시, 관련 시터 공고 닫기
    if (source_post_id) {
      try {
        const pool = require('mysql2/promise').createPool(require('./config/database-minimal').dbConfig)
        await pool.execute(`UPDATE sitter_postings SET status='closed' WHERE post_id = ?`, [source_post_id])
      } catch (e) {
        console.warn('sitter posting close warn:', e?.message)
      }
    }
    return res.json({ success: true, booking_id: result.bookingId })
  } catch (e) {
    console.error('booking create error', e)
    res.status(500).json({ success: false, message: e?.message || '예약 생성 실패' })
  }
})

// 대화방 메시지 히스토리 조회 (MongoDB)
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  const { conversationId } = req.params
  const { before, limit = 30 } = req.query
  try {
    const q = { conversationId }
    if (before) q.createdAt = { $lt: new Date(String(before)) }
    const items = await Message.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 100))
      .lean()
    res.json({ success: true, data: items.reverse() })
  } catch (e) {
    console.error('Query messages error', e)
    res.status(500).json({ success: false, error: 'Failed to fetch messages' })
  }
})

// S3 사전서명 URL 발급
app.post('/api/uploads/sign', async (req, res) => {
  const { fileName, contentType } = req.body || {}
  if (!fileName || !contentType) return res.status(400).json({ success: false, error: 'Invalid params' })
  try {
    const key = `uploads/${Date.now()}_${fileName}`
    const command = new PutObjectCommand({ Bucket: s3Bucket, Key: key, ContentType: contentType })
    const url = await getSignedUrl(s3, command, { expiresIn: 60 })
    res.json({ success: true, uploadUrl: url, key })
  } catch (e) {
    console.error('Presign error', e)
    res.status(500).json({ success: false, error: 'Failed to sign url' })
  }
})

// 데이터베이스 초기화 함수 제거
// MongoDB 및 MySQL 의존성 제거됨

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('사용자 연결됨:', socket.id)

  // 사용자 정보 저장
  socket.on('user:join', (userData) => {
    activeUsers.set(socket.id, userData)
    console.log('사용자 정보 등록:', userData)
  })

  // 대화방 참가
  socket.on('conversation:join', (conversationId) => {
    socket.join(conversationId)
    console.log(`사용자 ${socket.id}가 대화방 ${conversationId}에 참가`)
    
    // 대화방의 기존 메시지 히스토리 전송
    const messages = messageHistory.get(conversationId) || []
    socket.emit('messages:history', messages)
  })

  // 대화방 나가기
  socket.on('conversation:leave', (conversationId) => {
    socket.leave(conversationId)
    console.log(`사용자 ${socket.id}가 대화방 ${conversationId}에서 나감`)
  })

  // 메시지 전송 (MongoDB 저장)
  socket.on('message:send', async (data) => {
    const { conversationId, message, senderId, senderName, type = 'text', imageUri, fileName, fileSize } = data
    
    const newMessage = {
      conversationId,
      senderId,
      senderName,
      type,
      content: message,
      createdAt: new Date(),
      readBy: [{
        userId: senderId,
        readAt: new Date()
      }]
    }

    // 이미지나 파일의 경우 추가 정보 포함
    if (type === 'image' && imageUri) {
      newMessage.imageUri = imageUri
    } else if (type === 'file' && fileName) {
      newMessage.fileName = fileName
      newMessage.fileSize = fileSize
    }

    try {
      const saved = await Message.create(newMessage)
      await Conversation.updateOne({ _id: conversationId }, {
        lastMessageText: newMessage.type === 'text' ? newMessage.content : newMessage.type,
        lastMessageAt: new Date(),
      }, { upsert: true })

      // 대화방의 모든 사용자에게 메시지 전송
      io.to(conversationId).emit('message:received', {
        id: String(saved._id),
        ...newMessage,
        createdAt: saved.createdAt.toISOString(),
      })
      
      console.log(`대화방 ${conversationId}에서 메시지 전송:`, newMessage.content)
      
    } catch (error) {
      console.error('메시지 저장 오류:', error)
      socket.emit('message:error', { error: '메시지 전송에 실패했습니다.' })
    }
  })

  // 메시지 읽음 처리
  socket.on('message:read', (data) => {
    const { conversationId, messageId, userId } = data
    
    const messages = messageHistory.get(conversationId) || []
    const message = messages.find(m => m.id === messageId)
    
    if (message && !message.readBy.includes(userId)) {
      message.readBy.push(userId)
      
      // 대화방의 다른 사용자들에게 읽음 상태 알림
      socket.to(conversationId).emit('message:read_updated', {
        messageId,
        readBy: message.readBy
      })
    }
  })

  // 타이핑 상태
  socket.on('typing:start', (data) => {
    const { conversationId, userId, userName } = data
    socket.to(conversationId).emit('typing:user_started', { userId, userName })
  })

  socket.on('typing:stop', (data) => {
    const { conversationId, userId } = data
    socket.to(conversationId).emit('typing:user_stopped', { userId })
  })

  // 연결 해제
  socket.on('disconnect', () => {
    const userData = activeUsers.get(socket.id)
    activeUsers.delete(socket.id)
    console.log('사용자 연결 해제:', socket.id, userData?.name || 'Unknown')
  })
})

const PORT = process.env.PORT || 3001

console.log('[boot] starting http server on', PORT)
console.log('[debug] typeof server', typeof server, 'listen', typeof server.listen)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pet Buddy Server가 포트 ${PORT}에서 실행 중입니다!`)
  console.log(`💬 Socket.IO 서버가 활성화되었습니다.`)
  console.log(`🌐 서버 주소: http://localhost:${PORT}`)
  console.log(`📋 API 문서: http://localhost:${PORT}/`)
});

// Mongo 연결은 백그라운드에서 시도 (서버 기동과 무관)
(async () => {
  try {
    console.log('[boot] connecting to Mongo...')
    await connectMongo(process.env.MONGODB_URI)
    console.log('🍃 MongoDB 연결 완료')
  } catch (e) {
    console.warn('🍃 MongoDB 연결 경고:', e?.message)
  }
})()

