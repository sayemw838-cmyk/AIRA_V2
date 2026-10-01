export function createAiraState() {
  return {
    afterDarkModeActive: false,
    lockInSession: null,
    lockInWindow: null,
    lockInTimerId: null,
    db: null,
    taskState: { state: "idle", label: "", updatedAt: 0 },
    voice: {
      state: "ready",
      recorder: null,
      stream: null,
      chunks: [],
      mime: "",
      startedAt: 0,
      capTimer: null,
      tickTimer: null,
      errTimer: null,
      cancelled: false,
    },
    voiceDraft: false,
    turnIsVoice: false,
    voiceModeOn: false,
    currentConvId: null,
    sending: false,
    abortController: null,
    activeTaskId: null,
    taskCenter: null,
    lastUserText: "",
    stickToBottom: true,
  };
}

export function resetTransientState(state) {
  state.afterDarkModeActive = false;
  state.lockInSession = null;
  state.lockInWindow = null;
  state.lockInTimerId = null;
  state.voiceDraft = false;
  state.turnIsVoice = false;
  state.voiceModeOn = false;
  state.sending = false;
  state.abortController = null;
  state.activeTaskId = null;
  state.taskCenter = null;
  state.lastUserText = "";
  state.stickToBottom = true;
  return state;
}
