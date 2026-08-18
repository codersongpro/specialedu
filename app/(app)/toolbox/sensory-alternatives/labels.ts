const SENSITIVITY_VALUES = ['auditory', 'tactile', 'visual', 'vestibular', 'proprioceptive_seeking'] as const

export type SensitivityValue = (typeof SENSITIVITY_VALUES)[number]
export const SENSITIVITY_VALUES_LIST = SENSITIVITY_VALUES

export const SENSITIVITY_LABEL: Record<SensitivityValue, string> = {
  auditory: '청각 민감(큰 소리·시끄러운 곳)',
  tactile: '촉각 민감(특정 질감·신체 접촉)',
  visual: '시각 자극 민감(밝은 빛·현란한 화면)',
  vestibular: '전정감각 민감(회전·높이·불안정한 움직임)',
  proprioceptive_seeking: '고유수용성 감각 추구(꽉 조이거나 무거운 자극 선호)',
}
