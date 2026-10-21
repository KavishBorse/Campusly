import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, CameraOff, QrCode } from 'lucide-react';
import { api, jsonBody, messageOf } from '../api';

type DetectorResult = { rawValue?: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectorResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(value = token) {
    const clean = value.trim();
    if (!clean) return;
    setBusy(true); setError(''); setMessage('');
    try { const result = await api<{ message: string; event: string; session: string }>('/api/attendance/scan', { method: 'POST', body: jsonBody({ token: clean }) }); setMessage(`${result.message} ${result.event} · ${result.session}`); setToken(''); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function startCamera() {
    setError('');
    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) throw new Error('This browser does not support QR camera scanning. Enter the QR value manually below.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new Detector({ formats: ['qr_code'] });
      activeRef.current = true; setCameraOn(true);
      const scan = async () => {
        if (!activeRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const found = results.find((item) => item.rawValue)?.rawValue;
          if (found) { activeRef.current = false; setToken(found); await submit(found); return; }
        } catch { /* Continue scanning while the camera is warming up. */ }
        if (activeRef.current) window.setTimeout(scan, 250);
      };
      void scan();
    } catch (reason) { setError(messageOf(reason)); stopCamera(); }
  }

  function stopCamera() {
    activeRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  useEffect(() => () => { activeRef.current = false; streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  return <main className="auth-utility-page"><header className="public-header"><Link className="brand-lockup" to="/student"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><Link to="/student/attendance" className="text-link"><ArrowLeft size={15}/> My attendance</Link></header><section className="auth-utility-card scan-card"><span className="welcome-icon"><QrCode size={22}/></span><span className="form-eyebrow">SESSION CHECK-IN</span><h1>Scan the current QR.</h1><p>Attendance codes rotate every five seconds and only work during the session window.</p>{error && <div className="form-alert" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
    {cameraOn && <video ref={videoRef} className="qr-camera-preview" playsInline muted aria-label="QR camera preview"/>}
    <div className="scan-actions"><button className="button button--secondary" type="button" onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? <CameraOff size={16}/> : <Camera size={16}/>} {cameraOn ? 'Stop camera' : 'Open camera'}</button></div>
    <form className="tool-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label>Or enter the QR code value<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the current code" autoComplete="off"/></label><button className="button button--primary" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Check in'}</button></form>
    <p className="auth-utility-footnote">If your camera does not work, allow camera access in the browser or paste the current code.</p></section></main>;
}
