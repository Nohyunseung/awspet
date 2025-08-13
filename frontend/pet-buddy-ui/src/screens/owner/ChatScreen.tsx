import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useChatStore } from '../../store/chat'
import { useAuthStore } from '../../store/auth'

const OwnerChatScreen = ({ navigation }: any) => {
  const { user } = useAuthStore()
  const { conversations } = useChatStore()

  // 임시 대화 목록 데이터
  const mockConversations = [
    {
      id: 'conv_1',
      recipientId: 'sitter_1',
      recipientName: '김시터',
      recipientAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face',
      dogName: '멍멍이',
      dogPhoto: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=200&h=200&fit=crop&crop=face',
      lastMessage: {
        id: 'msg_1',
        content: '안녕하세요! 멍멍이 산책 잘 다녀왔어요 😊',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30분 전
        senderId: 'sitter_1',
        senderName: '김시터'
      },
      unreadCount: 2,
      bookingStatus: 'CONFIRMED',
      updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'conv_2',
      recipientId: 'sitter_2', 
      recipientName: '이펫시터',
      recipientAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      dogName: '뽀삐',
      dogPhoto: 'https://images.unsplash.com/photo-1616190264687-b7ebf7aa3e8e?w=200&h=200&fit=crop&crop=face',
      lastMessage: {
        id: 'msg_2',
        content: '내일 오전 9시에 방문 예정입니다',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
        senderId: 'sitter_2',
        senderName: '이펫시터'
      },
      unreadCount: 0,
      bookingStatus: 'PENDING',
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'conv_3',
      recipientId: 'sitter_3',
      recipientName: '박돌봄이',
      recipientAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
      dogName: '초코',
      dogPhoto: 'https://images.unsplash.com/photo-1574293876203-d4d48d3d7ba0?w=200&h=200&fit=crop&crop=face',
      lastMessage: {
        id: 'msg_3',
        content: '감사합니다! 다음에도 연락드릴게요',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
        senderId: 'owner_1',
        senderName: user?.fullName || '견주'
      },
      unreadCount: 0,
      bookingStatus: 'COMPLETED',
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}시간 전`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}일 전`
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'CONFIRMED': return '#10B981'
      case 'PENDING': return '#F59E0B'
      case 'COMPLETED': return '#6B7280'
      default: return '#9CA3AF'
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'CONFIRMED': return '확정'
      case 'PENDING': return '대기'
      case 'COMPLETED': return '완료'
      default: return ''
    }
  }

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => navigation.navigate('ChatRoom', {
        conversationId: item.id,
        recipientName: item.recipientName,
        dogName: item.dogName
      })}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.recipientAvatar }} style={styles.avatar} />
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.recipientName}>{item.recipientName}</Text>
            <Text style={styles.dogName}>• {item.dogName}</Text>
          </View>
          <View style={styles.metaContainer}>
            <Text style={styles.timeText}>{formatTime(item.lastMessage.createdAt)}</Text>
            {item.bookingStatus && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.bookingStatus) }]}>
                <Text style={styles.statusText}>{getStatusText(item.bookingStatus)}</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[
          styles.lastMessage,
          item.unreadCount > 0 ? styles.unreadMessage : styles.readMessage
        ]} numberOfLines={1}>
          {item.lastMessage.content}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>채팅</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* 대화 목록 */}
      <FlatList
        data={mockConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        style={styles.conversationsList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchButton: {
    padding: 4,
  },
  conversationsList: {
    flex: 1,
    backgroundColor: 'white',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dogName: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  metaContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 18,
  },
  unreadMessage: {
    color: '#111827',
    fontWeight: '500',
  },
  readMessage: {
    color: '#6B7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 76,
  },
})

export default OwnerChatScreen
