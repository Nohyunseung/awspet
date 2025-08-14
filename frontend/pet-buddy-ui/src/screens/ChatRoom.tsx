import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, SafeAreaView, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import io, { Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth'
import { useChatStore, ChatMessage } from '../store/chat'
import { apiService } from '../services/api'

type ChatRoomRouteParams = {
  ChatRoom: {
    conversationId: string
    recipientName?: string
    dogName?: string
  }
}

const ChatRoom = () => {
  const route = useRoute<RouteProp<ChatRoomRouteParams, 'ChatRoom'>>()
  const { user } = useAuthStore()
  const { messages, setMessages, addMessage } = useChatStore()

  const conversationId = route.params?.conversationId
  const recipientName = route.params?.recipientName || '상대'
  const dogName = route.params?.dogName

  const [input, setInput] = useState('')
  const listRef = useRef<FlatList<any>>(null)
  const socketRef = useRef<Socket | null>(null)

  const serverRoot = useMemo(() => {
    const root = (global as any).__API_SERVER_ROOT || (global as any).API_BASE || ''
    if (root) return root
    if (Platform.OS === 'android') return 'http://10.0.2.2:3001'
    return 'http://localhost:3001'
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      // 메시지 초기 로드 (REST)
      const res = await apiService.get<ChatMessage[]>(`/conversations/${conversationId}/messages`)
      if (!mounted) return
      if (res.success) {
        const items = (res.data as any) as any[]
        const mapped: ChatMessage[] = (items || []).map((m: any) => ({
          id: String(m._id || m.id || Math.random()),
          conversationId: conversationId,
          senderId: String(m.senderId || ''),
          senderName: String(m.senderName || ''),
          type: (m.type as any) || 'text',
          content: String(m.content || ''),
          imageUri: m.imageUri,
          fileName: m.fileName,
          fileSize: m.fileSize,
          createdAt: new Date(m.createdAt || m.created_at || Date.now()).toISOString(),
          readBy: Array.isArray(m.readBy) ? m.readBy : [],
        }))
        setMessages(conversationId, mapped)
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
      }

      // 소켓 연결
      const s = io(serverRoot, { transports: ['websocket'] })
      socketRef.current = s
      s.emit('conversation:join', conversationId)
      s.on('message:received', (payload: any) => {
        if (String(payload?.conversationId) !== String(conversationId)) return
        const msg: ChatMessage = {
          id: String(payload?.id || Math.random()),
          conversationId: conversationId,
          senderId: String(payload?.senderId || ''),
          senderName: String(payload?.senderName || ''),
          type: (payload?.type as any) || 'text',
          content: String(payload?.content || ''),
          imageUri: payload?.imageUri,
          fileName: payload?.fileName,
          fileSize: payload?.fileSize,
          createdAt: new Date(payload?.createdAt || Date.now()).toISOString(),
          readBy: Array.isArray(payload?.readBy) ? payload.readBy : [],
        }
        addMessage(msg)
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
      })
    }
    load()
    return () => {
      mounted = false
      try {
        socketRef.current?.emit('conversation:leave', conversationId)
        socketRef.current?.disconnect()
      } catch {}
    }
  }, [conversationId])

  const data = messages[conversationId] || []

  const handleSend = () => {
    const text = input.trim()
    if (!text || !user?.id) return
    const payload = {
      conversationId,
      message: text,
      senderId: user.id,
      senderName: user.fullName || '사용자',
      type: 'text',
    }
    socketRef.current?.emit('message:send', payload)
    setInput('')
  }

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = String(item.senderId) === String(user?.id)
    return (
      <View style={[styles.messageRow, mine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, mine ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.messageText, mine ? styles.textRight : styles.textLeft]}>{item.content}</Text>
          <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString().slice(0,5)}</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{recipientName}{dogName ? ` • ${dogName}` : ''}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  list: { flex: 1 },
  messageRow: { paddingHorizontal: 12, marginVertical: 6, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleLeft: { backgroundColor: '#F3F4F6', borderTopLeftRadius: 2 },
  bubbleRight: { backgroundColor: '#f97316', borderTopRightRadius: 2 },
  messageText: { fontSize: 14 },
  textLeft: { color: '#111827' },
  textRight: { color: 'white' },
  timeText: { marginTop: 4, fontSize: 10, color: '#9CA3AF', textAlign: 'right' },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  sendBtn: { backgroundColor: '#f97316', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
})

export default ChatRoom








