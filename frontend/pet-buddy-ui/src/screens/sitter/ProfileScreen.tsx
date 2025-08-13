import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth'

const SitterProfileScreen = ({ navigation }: any) => {
  const { user, signOut, activeRole, setActiveRole } = useAuthStore()
  const [isAvailable, setIsAvailable] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => signOut() },
      ]
    )
  }

  const sitterMenuItems = [
    {
      id: 'schedule',
      title: '일정 관리',
      subtitle: '예약된 돌봄 일정 확인',
      icon: 'calendar-outline',
      color: '#10B981',
    },
    {
      id: 'earnings',
      title: '수익 관리',
      subtitle: '이번 달 수익 및 정산 내역',
      icon: 'wallet-outline',
      color: '#3B82F6',
    },
    {
      id: 'reviews',
      title: '리뷰 관리',
      subtitle: '받은 리뷰 및 평점 확인',
      icon: 'star-outline',
      color: '#F59E0B',
    },
    {
      id: 'profile',
      title: '시터 프로필',
      subtitle: '경력, 소개글, 서비스 지역 설정',
      icon: 'person-outline',
      color: '#8B5CF6',
    },
    {
      id: 'certificates',
      title: '자격증 관리',
      subtitle: '펫시터 자격증 및 인증서',
      icon: 'ribbon-outline',
      color: '#EC4899',
    },
    {
      id: 'support',
      title: '고객 지원',
      subtitle: '문의사항 및 도움말',
      icon: 'help-circle-outline',
      color: '#6B7280',
    },
  ]

  const handleMenuPress = (menuId: string) => {
    Alert.alert('준비 중', `${sitterMenuItems.find(item => item.id === menuId)?.title} 기능은 준비 중입니다.`)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>시터 프로필</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 정보 */}
        <View style={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' }} 
                style={styles.avatar} 
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.fullName}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.rating}>4.8</Text>
                <Text style={styles.reviewCount}>(24개 리뷰)</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="pencil-outline" size={20} color="#0ea5e9" />
            </TouchableOpacity>
          </View>

          {/* 역할 정보 */}
          <View style={styles.rolesContainer}>
            <Text style={styles.rolesTitle}>이용 중인 서비스</Text>
            <View style={styles.rolesList}>
              {user?.roleOwner && (
                <View style={[styles.roleTag, activeRole === 'owner' ? styles.activeOwnerRole : styles.inactiveRole]}>
                  <Ionicons name="home" size={16} color={activeRole === 'owner' ? 'white' : '#f97316'} />
                  <Text style={[styles.roleTagText, activeRole === 'owner' ? styles.activeRoleText : styles.inactiveRoleText]}>
                    반려견 견주
                  </Text>
                </View>
              )}
              {user?.roleSitter && (
                <View style={[styles.roleTag, activeRole === 'sitter' ? styles.activeSitterRole : styles.inactiveRole]}>
                  <Ionicons name="briefcase" size={16} color={activeRole === 'sitter' ? 'white' : '#0ea5e9'} />
                  <Text style={[styles.roleTagText, activeRole === 'sitter' ? styles.activeRoleText : styles.inactiveRoleText]}>
                    펫시터
                  </Text>
                </View>
              )}
            </View>
            {user?.roleOwner && user?.roleSitter && (
              <TouchableOpacity
                style={styles.roleToggleButton}
                onPress={() => setActiveRole(activeRole === 'owner' ? 'sitter' : 'owner')}
              >
                <Ionicons 
                  name="swap-horizontal" 
                  size={20} 
                  color={activeRole === 'sitter' ? '#f97316' : '#0ea5e9'} 
                />
                <Text style={[styles.roleToggleText, { color: activeRole === 'sitter' ? '#f97316' : '#0ea5e9' }]}>
                  {activeRole === 'sitter' ? '견주 모드로 전환' : '시터 모드로 전환'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 시터 설정 */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>시터 설정</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>활동 상태</Text>
              <Text style={styles.settingDescription}>
                {isAvailable ? '새로운 요청을 받을 수 있습니다' : '현재 요청을 받지 않습니다'}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: '#E5E7EB', true: '#0ea5e9' }}
              thumbColor={isAvailable ? 'white' : '#9CA3AF'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>자동 수락</Text>
              <Text style={styles.settingDescription}>
                조건에 맞는 요청을 자동으로 수락합니다
              </Text>
            </View>
            <Switch
              value={autoAccept}
              onValueChange={setAutoAccept}
              trackColor={{ false: '#E5E7EB', true: '#0ea5e9' }}
              thumbColor={autoAccept ? 'white' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* 메뉴 목록 */}
        <View style={styles.menuContainer}>
          {sitterMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.id)}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 로그아웃 버튼 */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={styles.appInfoContainer}>
          <Text style={styles.appVersion}>Pet Buddy v1.0.0</Text>
          <Text style={styles.appDescription}>
            반려견과 시터를 연결하는 특별한 서비스
          </Text>
        </View>
      </ScrollView>
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
  settingsButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  editButton: {
    padding: 8,
  },
  rolesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 20,
  },
  rolesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  rolesList: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  activeOwnerRole: {
    backgroundColor: '#f97316',
  },
  activeSitterRole: {
    backgroundColor: '#0ea5e9',
  },
  inactiveRole: {
    backgroundColor: '#F3F4F6',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeRoleText: {
    color: 'white',
  },
  inactiveRoleText: {
    color: '#6B7280',
  },
  roleToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    marginTop: 8,
  },
  roleToggleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  settingsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  menuContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  appInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 8,
  },
  appVersion: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  appDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
})

export default SitterProfileScreen
