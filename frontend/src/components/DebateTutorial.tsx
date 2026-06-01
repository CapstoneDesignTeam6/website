import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Joyride, STATUS, ACTIONS } from 'react-joyride';
import type { EventData, Step, TooltipRenderProps, Options, Styles, PartialDeep } from 'react-joyride';
import { RefreshCw, Power, Maximize } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'debate_tutorial_skip';

function getStorageKey(userId?: number): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

function buildTutorialSteps(isDebating: boolean): Step[] {
  return [
    {
      target: 'body',
      placement: 'center',
      title: '👋 Agora에 오신 것을 환영합니다!',
      content: (
        <p style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          다음 버튼을 클릭하면서 주요 기능을 살펴보세요.
        </p>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-header',
      placement: 'bottom',
      title: '📌 토론 주제와 진행률',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>화면 상단에 현재 <strong>토론 주제</strong>와 전체 진행 상황이 표시돼요.</p>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
            진행률이 채워질수록 토론 완료에 가까워집니다.
          </p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-round-badge',
      placement: 'bottom',
      title: '🔁 라운드 구조',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>현재 라운드와 전체 라운드 수를 확인할 수 있어요.</p>
          <p style={{ marginTop: '0.375rem', marginBottom: '0.375rem'}}>
            토론은 <strong>총 2 라운드</strong>이고, 각 라운드는 아래 <strong>3단계</strong>로 진행돼요.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '0.375rem 0.75rem', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', borderRadius: '0.5rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>1️⃣ 주장</strong>
            </div>
            <span style={{ color: 'color-mix(in srgb, var(--color-on-surface) 45%, transparent)', fontWeight: 'bold' }}>→</span>
            <div style={{ padding: '0.375rem 0.75rem', background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', borderRadius: '0.5rem' }}>
              <strong style={{ color: 'var(--color-secondary)' }}>2️⃣ 반박</strong>
            </div>
            <span style={{ color: 'color-mix(in srgb, var(--color-on-surface) 45%, transparent)', fontWeight: 'bold' }}>→</span>
            <div style={{ padding: '0.375rem 0.75rem', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', borderRadius: '0.5rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>3️⃣ 재반박</strong>
            </div>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>2 라운드가 완료되면 토론을 계속 진행할지 선택할 수 있어요.</p>
        </div>
      ),
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tutorial-action-buttons',
      placement: 'bottom',
      title: '🎛️ 토론 제어 버튼',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', lineHeight: '1.6' }}>
            <li>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-primary)', color: '#ffffff', padding: '0.1875rem 0.5rem', borderRadius: '0.5rem', width: 'fit-content' }}><RefreshCw size={12} /><strong>다시 시작</strong></span>
              <span style={{ display: 'block', paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '1rem', color: 'var(--color-on-surface)' }}>동일 주제로 토론을 처음부터 시작해요.</span>
            </li>
            <li style={{ marginTop: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-secondary)', color: '#ffffff', padding: '0.1875rem 0.5rem', borderRadius: '0.5rem', width: 'fit-content' }}><Power size={12} /><strong>토론 종료</strong></span>
              <span style={{ display: 'block', paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '1rem', color: 'var(--color-on-surface)' }}>현재 토론을 마치고 결과 보고서 화면으로 이동해요. 2라운드 전에 종료할 경우 결과가 나오지 않을 수 있습니다.</span>
            </li>
            <li style={{ marginTop: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-surface-container)', color: 'var(--color-on-surface)', padding: '0.1875rem 0.5rem', borderRadius: '0.5rem', width: 'fit-content' }}><Maximize size={12} /><strong>전체 화면</strong></span>
              <span style={{ display: 'block', paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '1rem', color: 'var(--color-on-surface)' }}>화면을 넓게 펼쳐 토론에 더 집중할 수 있어요.</span>
            </li>
          </ul>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-chat-area',
      placement: 'right-start',
      title: '💬토론 공간',
      width: 300,
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>AI의 발언은 <strong>왼쪽</strong>, 내 발언은 <strong>오른쪽</strong>에 표시돼요.</p>
          <p>AI가 답변을 생성하는 동안 자료 탐색 · 논거 구성 등 <strong>단계별 사고 과정</strong>이 자동으로 표시돼요.</p>
          <p>실시간 평가 이후에 뜨는 <strong>평가 완료 · 보기</strong> 버튼을 누르면 해당 발언의 평가를 볼 수 있어요.</p>
          <div style={{ marginTop: '0.3125rem', padding: '0.625rem 0.75rem', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            <p style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>📝 주제 설명 및 사전·사후 퀴즈</p>
            <p>토론 <strong>시작 전</strong>에는 <strong>주제에 대한 설명</strong>과 주제 이해도를 확인하는 <strong>사전 퀴즈</strong>가 표시돼요.</p>
            <p style={{ marginTop: '0.25rem' }}>토론이 <strong>종료</strong>되면 토론 이해도를 점검하는 <strong>사후 퀴즈</strong>가 나와요.</p>
          </div>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: isDebating ? '#tutorial-input-area' : 'body',
      placement: isDebating ? 'top' : 'center',
      title: '✍️ 발언 입력하기',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          {isDebating
            ? <p>화면 하단의 <strong>입력창</strong>에 의견을 작성해주세요.</p>
            : <p>퀴즈가 끝나면 화면 하단에 <strong>입력창</strong>이 나타나요.</p>
          }
          <p><strong>Ctrl + Enter</strong>를 눌러 의견을 제출해주세요.</p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: isDebating ? '#tutorial-help-button' : 'body',
      placement: isDebating ? 'left' : 'center',
      title: '🤖 보조 에이전트',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          {isDebating
            ? <p>화면 오른쪽 하단의 <strong>보조 에이전트</strong> 버튼이에요.</p>
            : <p>퀴즈가 끝나면 화면 오른쪽 하단에 <strong>보조 에이전트</strong> 버튼이 나타나요.</p>
          }
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>팝업창 왼쪽 상단 모서리를 드래그하면 창 크기를 조절할 수 있어요.</p>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
              <p style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>📢 단계별 작성 도움말</p>
              <p>주장·반박·재반박 단계가 바뀔 때마다 보조 에이전트가 자동으로 현재 단계에 맞는 도움말을 알려줘요.</p>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
              <p style={{ fontWeight: 'bold', color: 'var(--color-secondary)', marginBottom: '0.25rem' }}>💡 반박·재반박 힌트</p>
              <p>반박·재반박 단계에서는 팝업창 하단에 <strong>힌트</strong> 버튼이 나타나요. AI가 이 상황에 맞는 반박 전략을 제안해 줍니다.</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>힌트는 참고용이에요. 이해한 내용을 내 말로 정리해보세요.</p>
            </div>
          </div>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-score-panel',
      placement: 'right',
      title: '📊 실시간 발언 평가 지표',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>발언할 때마다 AI가 5가지 기준으로 내 의견을 자동으로 분석해요.</p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', lineHeight: '1.9' }}>
            <li><strong>발언 구체성</strong> : 수치·사례·출처의 정밀도</li>
            <li><strong>인과 연결</strong> : 원인-결과-함의 연결 깊이</li>
            <li><strong>도메인 폭</strong> : 다양한 영역을 넘나드는 정도</li>
            <li><strong>정보 자립도</strong> : 스스로 구성한 정보 비율</li>
            <li><strong>개념 정확도</strong> : 전문 용어의 정확한 사용</li>
          </ul>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
            지표 이름을 클릭하면 점수와 함께 AI의 평가 이유를 볼 수 있어요.
          </p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-materials-panel',
      placement: 'left',
      title: '📚 관련 자료',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>토론 주제와 관련된 <strong>참고 자료</strong>가 자동으로 표시돼요.</p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', lineHeight: '1.9' }}>
            <li>뉴스·논문·보고서 등 다양한 출처의 자료를 확인할 수 있어요.</li>
            <li><strong>AI가 참고한 자료</strong> 태그가 붙은 자료는 현재 AI의 발언 생성에 사용된 자료예요.</li>
            <li>원문 보기 혹은 PDF 보기 버튼을 통해 자료를 직접 열람할 수 있어요.</li>
          </ul>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
            자료를 참고해 내 주장을 더 탄탄하게 만들어 보세요.
          </p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '#tutorial-score-toggle',
      placement: 'right',
      title: '◀️▶️ 사이드바 열고 닫기',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <p>사이드바 가장자리의 <strong>화살표 버튼</strong>으로 패널을 열고 닫을 수 있어요.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
            화면이 좁을 때는 사이드바를 닫아 채팅 공간을 넓게 쓸 수 있어요.
          </p>
        </div>
      ),
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: 'body',
      placement: 'center',
      title: '🎉 토론 준비 완료!',
      content: (
        <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', lineHeight: '1.9' }}>
            <li><strong>주장 → 반박 → 재반박</strong> 흐름을 기억해주세요.</li>
            <li>관련 자료와 보조 에이전트를 활용해보세요.</li>
            <li>평가 점수와 이유를 보면서 주장을 보완해보세요.</li>
            <li>사전·사후 퀴즈로 얼마나 달라졌는지 확인해보세요.</li>
          </ul>
          <p style={{ marginTop: '0.75rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            그럼 토론을 시작해볼까요? 🚀
          </p>
        </div>
      ),
      skipBeacon: true,
    },
  ];
}

const tutorialOptions: Partial<Options> = {
  primaryColor: 'var(--color-primary)',
  overlayColor: 'rgba(0, 0, 0, 0.45)',
  zIndex: 10000,
  scrollOffset: 80,
  scrollDuration: 400,
  overlayClickAction: false,
  targetWaitTimeout: 5000,
  width: 460,
};

const tutorialStyles: PartialDeep<Styles> = {
  tooltip: {
    borderRadius: '1rem',
    padding: '0',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  tooltipTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    marginBottom: '0.625rem',
    color: 'var(--color-on-surface)',
  },
  tooltipContent: {
    padding: '0 0 0.25rem',
  },
  tooltipFooter: {
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--color-surface-container)',
  },
  buttonPrimary: {
    backgroundColor: 'var(--color-primary)',
    borderRadius: '0.625rem',
    fontSize: '0.9375rem',
    fontWeight: '700',
    padding: '0.5rem 1.125rem',
  },
  buttonBack: {
    color: 'var(--color-outline)',
    fontSize: '0.9375rem',
    fontWeight: '600',
    marginRight: '0.375rem',
  },
  buttonClose: {
    top: '0.75rem',
    right: '0.75rem',
    color: 'color-mix(in srgb, var(--color-on-surface) 45%, transparent)',
  },
};

// ── 커스텀 툴팁: "다시 보지 않기" 체크박스 포함, 닫기 버튼이 건너뛰기 역할 ──
interface CustomTooltipProps extends TooltipRenderProps {
  neverShowRef: React.MutableRefObject<boolean>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  index,
  step,
  size,
  isLastStep,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  neverShowRef,
}) => {
  const [neverShow, setNeverShow] = useState(neverShowRef.current);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetWidth = (step.width as number | undefined) ?? 500;

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const floater = el.closest('.react-joyride__floater') as HTMLElement | null;
    if (floater) {
      floater.style.width = `${targetWidth}px`;
      floater.style.maxWidth = `${targetWidth}px`;
    }
  }, [targetWidth]);

  return (
    <div
      ref={tooltipRef}
      {...tooltipProps}
      style={{
        background: '#ffffff',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        position: 'relative',
        fontFamily: 'inherit',
        width: targetWidth,
        maxWidth: targetWidth,
        pointerEvents: 'auto',
      }}
    >
      {/* 닫기 버튼 (건너뛰기 역할) */}
      <button
        {...closeProps}
        style={{
          position: 'absolute',
          top: '0.875rem',
          right: '0.875rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'color-mix(in srgb, var(--color-on-surface) 45%, transparent)',
          fontSize: '1.125rem',
          lineHeight: 1,
          padding: '0.125rem',
        }}
        aria-label="닫기"
      >
        ✕
      </button>

      {/* 제목 */}
      {step.title && (
        <div style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--color-on-surface)', marginBottom: '0.625rem', paddingRight: '1.5rem' }}>
          {step.title}
        </div>
      )}

      {/* 본문 */}
      <div style={{ fontSize: '1rem', color: 'var(--color-on-surface)', lineHeight: '1.6' }}>
        {step.content}
      </div>

      {/* 하단 푸터 */}
      <div
        style={{
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--color-surface-container)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        {/* 다시 보지 않기 행 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label
          onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              color: 'var(--color-outline)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={neverShow}
              onChange={(e) => {
                neverShowRef.current = e.target.checked;
                setNeverShow(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '0.875rem',
                height: '0.875rem',
                accentColor: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            />
            다시 보지 않기
          </label>
        </div>

        {/* 스텝 카운터 + 이전/다음 행 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8125rem', color: 'color-mix(in srgb, var(--color-on-surface) 45%, transparent)' }}>
            {index + 1} / {size}
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {index > 0 && (
              <button
                {...backProps}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-surface-container)',
                  borderRadius: '0.625rem',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                  color: 'var(--color-outline)',
                  fontWeight: '600',
                  padding: '0.4375rem 1rem',
                }}
              >
                이전
              </button>
            )}
            <button
              {...primaryProps}
              style={{
                background: 'var(--color-primary)',
                border: 'none',
                borderRadius: '0.625rem',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                color: '#ffffff',
                fontWeight: '700',
                padding: '0.5rem 1.125rem',
              }}
            >
              {isLastStep ? '토론 시작' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 메인 튜토리얼 컴포넌트 ──
interface DebateTutorialProps {
  run: boolean;
  onFinish: () => void;
  userId?: number;
  isDebating?: boolean;
}

export const DebateTutorial: React.FC<DebateTutorialProps> = ({ run, onFinish, userId, isDebating = false }) => {
  const neverShowRef = useRef(false);
  const steps = buildTutorialSteps(isDebating);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (run) {
      neverShowRef.current = false;
      setStepIndex(0);
    }
  }, [run]);

  const saveNeverShow = () => {
    const key = getStorageKey(userId);
    if (userId) {
      localStorage.setItem(key, 'true');
    } else {
      sessionStorage.setItem(key, 'true');
    }
  };

  const handleEvent = (data: EventData) => {
    const { status, action, index, type } = data;

    const finished = status === STATUS.FINISHED;
    const skipped = status === STATUS.SKIPPED;
    const closed = action === ACTIONS.CLOSE;

    if (finished || skipped || closed) {
      if (neverShowRef.current) saveNeverShow();
      onFinish();
      return;
    }

    if (type === 'step:after') {
      if (action === ACTIONS.NEXT) setStepIndex(index + 1);
      else if (action === ACTIONS.PREV) setStepIndex(index - 1);
    }
  };

  const TooltipComponent = useCallback((props: TooltipRenderProps) => (
    <CustomTooltip {...props} neverShowRef={neverShowRef} />
  ), []);

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={tutorialOptions}
      styles={tutorialStyles}
      locale={{
        back: '이전',
        close: '닫기',
        last: '완료',
        next: '다음',
        open: '튜토리얼 열기',
        skip: '건너뛰기',
      }}
      tooltipComponent={TooltipComponent}
    />
  );
};

export { STORAGE_KEY_PREFIX as TUTORIAL_STORAGE_KEY, getStorageKey as getTutorialStorageKey };
