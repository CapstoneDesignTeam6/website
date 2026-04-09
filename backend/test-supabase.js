import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// .env 파일 로드
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY// 또는 SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConnection() {
  try {
    // 1. 아주 가벼운 쿼리로 연결 테스트 (auth 스키마의 설정 등을 확인하거나 빈 select 실행)
    const { data, error } = await supabase
      .from('users') // 실제로 존재하는 테이블 이름을 넣으세요
      .select('*')
      .limit(1)

    if (error) {
      throw error
    }

    console.log('✅ Supabase 연결 성공!')
    console.log('데이터 샘플:', data)
    
  } catch (error) {
    console.error('❌ Supabase 연결 실패:')
    console.error('메시지:', error.message)
    console.error('상태 코드:', error.code)
    
    // 팁: 에러 코드에 따른 점검 사항
    if (error.message.includes('fetch')) {
      console.log('💡 URL이 잘못되었거나 네트워크 연결을 확인하세요.');
    } else if (error.code === 'PGRST301') {
      console.log('💡 API Key(JWT)가 유효하지 않을 수 있습니다.');
    }
  }
}

checkConnection()