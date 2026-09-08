/**
 * VideoCallModal – Retired legacy shim (Doctor App).
 * Directs all video calls to RuralCare's custom WhatsApp-style 1-to-1 CallModal.
 * Completely eliminates the legacy Jitsi Meet web conference iframe and moderator screens.
 */

import { CallModal } from './CallModal';

export { CallModal as VideoCallModal };
export default CallModal;
