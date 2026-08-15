export const ASSESSMENT_MODES = Object.freeze({
  IN_APP_AUTOSCORE: 'IN_APP_AUTOSCORE',
  CLINICIAN_RATED: 'CLINICIAN_RATED',
  OFFICIAL_EXTERNAL: 'OFFICIAL_EXTERNAL'
});

export const TOOL_ASSESSMENT_MODES = Object.freeze({
  'NRS-2002': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'MNA-SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  '7-point SGA': ASSESSMENT_MODES.CLINICIAN_RATED,
  'RFH-NPT': ASSESSMENT_MODES.IN_APP_AUTOSCORE,
  'PG-SGA SF': ASSESSMENT_MODES.OFFICIAL_EXTERNAL,
  mNUTRIC: ASSESSMENT_MODES.IN_APP_AUTOSCORE
});

export function createEmptyToolAssessment(toolId) {
  return {
    answers: {},
    nativeStatus: 'NOT_STARTED',
    nativeScore: null,
    nativeCategory: '',
    completedAt: '',
    sourceMode: TOOL_ASSESSMENT_MODES[toolId]
  };
}

export function createInitialToolAssessments() {
  return Object.fromEntries(
    Object.keys(TOOL_ASSESSMENT_MODES).map((toolId) => [toolId, createEmptyToolAssessment(toolId)])
  );
}

export function updateToolAssessment(store, toolId, patch) {
  const current = store[toolId] || createEmptyToolAssessment(toolId);
  const answers = { ...current.answers, ...patch };
  const hasRecordedAnswer = Object.values(answers).some((value) => value !== '' && value != null && value !== false);

  return {
    ...store,
    [toolId]: {
      ...current,
      answers,
      nativeStatus: hasRecordedAnswer ? 'IN_PROGRESS' : 'NOT_STARTED'
    }
  };
}
