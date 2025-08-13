require('dotenv').config()
const mysql = require('mysql2/promise')
const { v4: uuidv4 } = require('uuid')

// 데이터베이스 연결 설정 (직접 설정)
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shrlgur03@',  // 원래 비밀번호로 변경
  database: 'pet_buddy',
  port: 3307,
  charset: 'utf8mb4'
}

// 연결 풀 생성
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

// 연결 테스트 함수
async function testConnection() {
  try {
    const connection = await pool.getConnection()
    console.log('🔍 데이터베이스 연결 테스트 중...')
    
    const [rows] = await connection.execute('SELECT 1 as test')
    console.log('✅ MySQL 연결 성공!')
    
    const [dbInfo] = await connection.execute('SELECT DATABASE() as currentDB')
    console.log('📁 현재 데이터베이스:', dbInfo[0].currentDB)
    
    // 테이블 존재 확인
    const tables = ['users', 'sitters', 'dogs', 'bookings', 'sitter_postings', 'job_postings']
    for (const table of tables) {
      const [tableCheck] = await connection.execute(`SHOW TABLES LIKE '${table}'`)
      if (tableCheck.length > 0) {
        console.log(`✅ ${table} 테이블 확인됨`)
      } else {
        console.log(`⚠️  ${table} 테이블이 없습니다.`)
      }
    }
    
    connection.release()
    return true
  } catch (error) {
    console.error('❌ 연결 테스트 실패:', error.message)
    return false
  }
}

// === USERS 테이블 함수들 ===

// 이메일로 사용자 찾기
async function findUserByEmail(email) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    )
    return rows[0] || null
  } catch (error) {
    console.error('사용자 조회 실패:', error)
    throw error
  }
}

// ID로 사용자 찾기
async function findUserById(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    )
    return rows[0] || null
  } catch (error) {
    console.error('사용자 조회 실패:', error)
    throw error
  }
}

// 새 사용자 생성
async function createUser(userData) {
  const { email, password_hash, phone_number } = userData
  
  try {
    // 기본: password_hash 컬럼 사용
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, phone_number) VALUES (?, ?, ?)',
      [email, password_hash, phone_number || null]
    )
    console.log('✅ 새 사용자 생성 완료. ID:', result.insertId)
    return { success: true, userId: result.insertId }
  } catch (error) {
    // 컬럼이 없을 경우 password 컬럼로 폴백 시도
    const isUnknownPasswordHashColumn =
      error?.code === 'ER_BAD_FIELD_ERROR' ||
      /Unknown column 'password_hash'/.test(String(error?.message || ''))
    if (isUnknownPasswordHashColumn) {
      try {
        const [result2] = await pool.execute(
          'INSERT INTO users (email, password, phone_number) VALUES (?, ?, ?)',
          [email, password_hash, phone_number || null]
        )
        console.log('✅ 새 사용자 생성 완료(backup 컬럼). ID:', result2.insertId)
        return { success: true, userId: result2.insertId }
      } catch (e2) {
        if (e2.code === 'ER_DUP_ENTRY') {
          throw new Error('이미 존재하는 이메일 또는 전화번호입니다.')
        }
        console.error('사용자 생성 실패(backup 경로):', e2)
        throw e2
      }
    }
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('이미 존재하는 이메일 또는 전화번호입니다.')
    }
    console.error('사용자 생성 실패:', error)
    throw error
  }
}

// === SITTERS 테이블 함수들 ===

// 시터 프로필 생성
async function createSitterProfile(userId, sitterData) {
  const { self_introduction } = sitterData
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO sitters (user_id, self_introduction) VALUES (?, ?)',
      [userId, self_introduction || null]
    )
    
    console.log('✅ 시터 프로필 생성 완료. ID:', result.insertId)
    
    return {
      success: true,
      sitterId: result.insertId
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('이미 시터 프로필이 존재합니다.')
    }
    console.error('시터 프로필 생성 실패:', error)
    throw error
  }
}

// 시터 프로필 조회
async function getSitterByUserId(userId) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.email, u.phone_number 
       FROM sitters s 
       JOIN users u ON s.user_id = u.user_id 
       WHERE s.user_id = ?`,
      [userId]
    )
    return rows[0] || null
  } catch (error) {
    console.error('시터 조회 실패:', error)
    throw error
  }
}

// 모든 시터 목록 조회
async function getAllSitters() {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.email, u.phone_number 
       FROM sitters s 
       JOIN users u ON s.user_id = u.user_id 
       ORDER BY s.total_earnings DESC`
    )
    return rows
  } catch (error) {
    console.error('시터 목록 조회 실패:', error)
    throw error
  }
}

// === DOGS 테이블 함수들 ===

// 반려견 등록
async function createDog(dogData) {
  const { user_id, name, profile_image_url, breed, personality, birth_date, special_notes } = dogData
  
  try {
    const dogId = uuidv4()
    await pool.execute(
      `INSERT INTO dogs (id, owner_id, name, breed, personality, notes, photo_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dogId, user_id, name, breed || null, personality || null, special_notes || null, profile_image_url || null]
    )
    
    console.log('✅ 반려견 등록 완료. ID:', dogId)
    
    return {
      success: true,
      dogId: dogId
    }
  } catch (error) {
    console.error('반려견 등록 실패:', error)
    throw error
  }
}

// 사용자의 반려견 목록 조회
async function getDogsByUserId(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM dogs WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return rows
  } catch (error) {
    console.error('반려견 목록 조회 실패:', error)
    throw error
  }
}

// 반려견 삭제
async function deleteDogByIdOwner(dogId, ownerId) {
  try {
    const [result] = await pool.execute(
      'DELETE FROM dogs WHERE id = ? AND owner_id = ?',
      [dogId, ownerId]
    )
    return { success: result.affectedRows > 0, affectedRows: result.affectedRows }
  } catch (error) {
    console.error('반려견 삭제 실패:', error)
    throw error
  }
}

// === BOOKINGS 테이블 함수들 ===

// 예약 생성 (스키마 자동 감지 + ID 정규화)
async function createBooking(bookingData) {
  const rawOwner = bookingData.owner_user_id ?? bookingData.owner_id
  const rawSitter = bookingData.sitter_user_id ?? bookingData.sitter_id
  const rawDog = bookingData.dog_id ?? bookingData.dogId
  const { start_time, end_time } = bookingData

  if (!rawOwner || !rawSitter || !rawDog || !start_time || !end_time) {
    throw new Error('필수 필드 누락 (owner, sitter, dog, start_time, end_time)')
  }

  let connection
  try {
    connection = await pool.getConnection()

    // bookings 컬럼 감지
    const [bCols] = await connection.execute(`SHOW COLUMNS FROM bookings`)
    const bNames = bCols.map(c => c.Field)
    const ownerCol = bNames.includes('owner_user_id') ? 'owner_user_id' : (bNames.includes('owner_id') ? 'owner_id' : null)
    const sitterCol = bNames.includes('sitter_user_id') ? 'sitter_user_id' : (bNames.includes('sitter_id') ? 'sitter_id' : null)
    const dogCol = bNames.includes('dog_id') ? 'dog_id' : (bNames.includes('dogId') ? 'dogId' : null)
    const hasIdCol = bNames.includes('id')
    const hasStartTime = bNames.includes('start_time')
    const hasEndTime = bNames.includes('end_time')
    const hasStartDate = bNames.includes('start_date')
    const hasEndDate = bNames.includes('end_date')
    const hasStatus = bNames.includes('booking_status')
    const hasLocation = bNames.includes('location')
    if (!ownerCol || !sitterCol || !dogCol) {
      throw new Error('bookings 테이블 컬럼을 확인하세요 (owner/sitter/dog)')
    }

    // users 컬럼 감지 및 값 정규화
    const [uCols] = await connection.execute(`SHOW COLUMNS FROM users`)
    const uNames = uCols.map(c => c.Field)
    const usersPkUserId = uNames.includes('user_id')
    const usersAltId = uNames.includes('id')

    async function normalizeUserValue(input, targetIsUserId) {
      // 이미 숫자로 보이고 target이 user_id면 바로 사용 시도
      if (targetIsUserId && /^\d+$/.test(String(input))) return Number(input)
      // 쿼리로 매핑(id 또는 user_id에서 찾기)
      const [rows] = await connection.execute(
        `SELECT ${usersPkUserId ? 'user_id' : 'NULL'} AS user_id, ${usersAltId ? 'id' : 'NULL'} AS id FROM users 
         WHERE ${usersPkUserId ? 'user_id = ?' : '1=0'} ${usersAltId ? ' OR id = ?' : ''} LIMIT 1`,
        usersPkUserId && usersAltId ? [input, input] : (usersPkUserId ? [input] : [input])
      )
      const row = rows?.[0]
      if (!row) return null
      return targetIsUserId ? row.user_id : row.id
    }

    const ownerVal = await normalizeUserValue(rawOwner, ownerCol.endsWith('user_id'))
    const sitterVal = await normalizeUserValue(rawSitter, sitterCol.endsWith('user_id'))

    // dogs 컬럼 감지 및 값 정규화
    const [dCols] = await connection.execute(`SHOW COLUMNS FROM dogs`)
    const dNames = dCols.map(c => c.Field)
    const dogsHasDogId = dNames.includes('dog_id')
    const dogsHasId = dNames.includes('id')

    async function normalizeDogValue(input, targetCol) {
      const wantDogIdCol = targetCol.toLowerCase() === 'dog_id'
      // 숫자 FK 기대 시 숫자면 그대로 사용 (과거 INT 스키마 대비)
      if (wantDogIdCol && /^\d+$/.test(String(input))) return Number(input)
      // 매핑 시도: dogs.dog_id와 dogs.id 둘 다 조회해 가능한 값을 반환
      const [rows] = await connection.execute(
        `SELECT ${dogsHasDogId ? 'dog_id' : 'NULL'} AS dog_id, ${dogsHasId ? 'id' : 'NULL'} AS id FROM dogs 
         WHERE ${dogsHasDogId ? 'dog_id = ?' : '1=0'} ${dogsHasId ? ' OR id = ?' : ''} LIMIT 1`,
        dogsHasDogId && dogsHasId ? [input, input] : (dogsHasDogId ? [input] : [input])
      )
      const row = rows?.[0]
      if (!row) return null
      // 현재 스키마는 bookings.dog_id → dogs.id(UUID). dog_id 컬럼이 없으면 id 사용
      if (wantDogIdCol) return row.dog_id || row.id || input
      return row.id || row.dog_id || input
    }

    const dogVal = await normalizeDogValue(rawDog, dogCol)
    if (ownerVal == null) throw new Error('유효하지 않은 owner_id')
    if (sitterVal == null) throw new Error('유효하지 않은 sitter_id')
    if (dogVal == null) throw new Error('유효하지 않은 dog_id')

    // INSERT (동적 컬럼 채우기)
    const fields = []
    const params = []
    if (hasIdCol) { fields.push('id'); params.push(uuidv4()) }
    fields.push(ownerCol); params.push(ownerVal)
    fields.push(sitterCol); params.push(sitterVal)
    fields.push(dogCol); params.push(dogVal)
    if (hasStartTime) { fields.push('start_time'); params.push(start_time) }
    if (hasEndTime) { fields.push('end_time'); params.push(end_time) }
    if (hasLocation) { fields.push('location'); params.push(bookingData.location || '') }
    if (hasStartDate) { fields.push('start_date'); params.push(String(start_time).slice(0,10)) }
    if (hasEndDate) { fields.push('end_date'); params.push(String(end_time).slice(0,10)) }
    if (hasStatus) { fields.push('booking_status'); params.push('confirmed') }

    const [result] = await connection.execute(
      `INSERT INTO bookings (${fields.join(', ')}) VALUES (${fields.map(()=>'?').join(', ')})`,
      params
    )

    connection.release()
    console.log('✅ 예약 생성 완료. ID:', result.insertId)
    return { success: true, bookingId: result.insertId }
  } catch (error) {
    try { connection?.release() } catch {}
    console.error('예약 생성 실패:', error)
    throw error
  }
}

// 사용자의 예약 목록 조회 (견주 관점) - 스키마 자동 감지 조인
async function getBookingsByOwnerId(ownerId) {
  let connection
  try {
    connection = await pool.getConnection()
    // bookings
    const [bCols] = await connection.execute(`SHOW COLUMNS FROM bookings`)
    const b = bCols.map(c => c.Field)
    const ownerCol = b.includes('owner_user_id') ? 'owner_user_id' : (b.includes('owner_id') ? 'owner_id' : null)
    const sitterCol = b.includes('sitter_user_id') ? 'sitter_user_id' : (b.includes('sitter_id') ? 'sitter_id' : null)
    const dogCol = b.includes('dog_id') ? 'dog_id' : (b.includes('dogId') ? 'dogId' : null)
    if (!ownerCol || !sitterCol || !dogCol) throw new Error('bookings 컬럼 확인 필요')

    // dogs
    const [dCols] = await connection.execute(`SHOW COLUMNS FROM dogs`)
    const d = dCols.map(c => c.Field)
    const dogPk = d.includes('id') ? 'id' : (d.includes('dog_id') ? 'dog_id' : null)
    const dogNameCol = d.includes('name') ? 'name' : (d.includes('dog_name') ? 'dog_name' : null)
    const dogPhotoCol = d.includes('photo_url') ? 'photo_url' : (d.includes('profile_image_url') ? 'profile_image_url' : null)
    if (!dogPk) throw new Error('dogs PK 컬럼 확인 필요')

    // users
    const [uCols] = await connection.execute(`SHOW COLUMNS FROM users`)
    const u = uCols.map(c => c.Field)
    const userPk = u.includes('user_id') ? 'user_id' : (u.includes('id') ? 'id' : null)
    const userEmail = u.includes('email') ? 'email' : 'email'
    if (!userPk) throw new Error('users PK 컬럼 확인 필요')

    const sql = `
      SELECT b.*, d.${dogNameCol || 'name'} AS dog_name,
             d.${dogPhotoCol || 'photo_url'} AS dog_photo_url,
             u.${userEmail} AS sitter_email
      FROM bookings b
      JOIN dogs d ON b.${dogCol} = d.${dogPk}
      JOIN users u ON b.${sitterCol} = u.${userPk}
      WHERE b.${ownerCol} = ?
      ORDER BY b.start_time ASC`
    const [rows] = await connection.execute(sql, [ownerId])
    connection.release()
    return rows
  } catch (error) {
    try { connection?.release() } catch {}
    console.error('예약 목록 조회 실패:', error)
    throw error
  }
}

// 시터의 예약 목록 조회 (시터 관점)
async function getBookingsBySitterId(sitterId) {
  try {
    const [rows] = await pool.execute(
      `SELECT b.*, d.name as dog_name, u.email as owner_email 
       FROM bookings b 
       JOIN dogs d ON b.dog_id = d.dog_id 
       JOIN users u ON b.owner_user_id = u.user_id 
       WHERE b.sitter_user_id = ? 
       ORDER BY b.start_time DESC`,
      [sitterId]
    )
    return rows
  } catch (error) {
    console.error('예약 목록 조회 실패:', error)
    throw error
  }
}

// 예약 상태 업데이트
async function updateBookingStatus(bookingId, status) {
  try {
    const [result] = await pool.execute(
      'UPDATE bookings SET booking_status = ? WHERE booking_id = ?',
      [status, bookingId]
    )
    
    return {
      success: result.affectedRows > 0,
      affectedRows: result.affectedRows
    }
  } catch (error) {
    console.error('예약 상태 업데이트 실패:', error)
    throw error
  }
}

// 연결 풀 종료 함수
async function closePool() {
  try {
    await pool.end()
    console.log('🔒 데이터베이스 연결 풀이 종료되었습니다.')
  } catch (error) {
    console.error('❌ 연결 풀 종료 실패:', error)
  }
}

// 모든 함수 내보내기
module.exports = {
  pool,
  testConnection,
  
  // Users
  findUserByEmail,
  findUserById,
  createUser,
  
  // Sitters
  createSitterProfile,
  getSitterByUserId,
  getAllSitters,
  
  // Dogs
  createDog,
  getDogsByUserId,
  deleteDogByIdOwner,
  
  // Bookings
  createBooking,
  getBookingsByOwnerId,
  getBookingsBySitterId,
  updateBookingStatus,
 
  // Jobs (owner postings)
  async createJobPosting(job) {
    const { owner_id, dog_id, title, description, location, start_date, end_date, status = 'active' } = job
    try {
      const [result] = await pool.execute(
        `INSERT INTO job_postings (owner_id, dog_id, title, description, location, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [owner_id, dog_id, title, description || null, location || null, start_date, end_date, status]
      )
      return { success: true, jobId: result.insertId }
    } catch (e) {
      console.error('공고 생성 실패:', e)
      throw e
    }
  },
  async getAllActiveOwnerJobs() {
    try {
      const [rows] = await pool.execute(
        `SELECT jp.*, 
                u.full_name AS owner_name, u.email AS owner_email,
                d.name AS dog_name, d.breed AS dog_breed, d.photo_url AS dog_photo_url
         FROM job_postings jp
         JOIN users u ON jp.owner_id = u.id
         LEFT JOIN dogs d ON jp.dog_id = d.id
         WHERE jp.status = 'active'
         ORDER BY jp.created_at DESC`
      )
      return rows
    } catch (e) {
      console.error('공고 목록 조회 실패:', e)
      throw e
    }
  },

  async updateJobPostingStatus(jobId, status) {
    try {
      const [result] = await pool.execute(
        `UPDATE job_postings SET status = ? WHERE job_id = ?`,
        [status, jobId]
      )
      return { success: result.affectedRows > 0, affectedRows: result.affectedRows }
    } catch (e) {
      console.error('공고 상태 업데이트 실패:', e)
      throw e
    }
  },
  
   // Sitter postings (full schema restore)
   async createSitterPosting(data) {
     const { sitter_id, title, description, location, available_from, available_to, status = 'active' } = data
     try {
       const [result] = await pool.execute(
         `INSERT INTO sitter_postings (sitter_id, title, description, location, available_from, available_to, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
         [sitter_id, title, description || null, location || null, available_from, available_to, status]
       )
       return { success: true, postId: result.insertId }
     } catch (error) {
       console.error('시터 공고 생성 실패:', error)
       throw error
     }
   },
   async getAllActiveSitterPostings() {
     try {
       const [rows] = await pool.execute(
         `SELECT sp.*, u.full_name AS sitter_name, u.email AS sitter_email
          FROM sitter_postings sp
          JOIN users u ON sp.sitter_id = u.id
          WHERE sp.status = 'active'
          ORDER BY sp.created_at DESC`
       )
       return rows
     } catch (error) {
       console.error('시터 공고 목록 조회 실패:', error)
       throw error
     }
   },
  
  closePool,
  dbConfig
}
