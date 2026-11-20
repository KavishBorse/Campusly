import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, CameraOff, QrCode } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { api, jsonBody, messageOf } from '../api';
import { BrandLogo } from '../ui/BrandLogo';

export function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
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
    const video = videoRef.current;
    if (!video) {
      setError('The camera preview could not be opened. Refresh the page and try again.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs a secure browser connection (HTTPS or localhost). You can paste the QR value below.');
      return;
    }

    activeRef.current = true;
    setCameraOn(true);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        video,
        (result, _decodeError, callbackControls) => {
          const found = result?.getText().trim();
          if (!found || !activeRef.current) return;
          activeRef.current = false;
          callbackControls.stop();
          scannerControlsRef.current = null;
          setCameraOn(false);
          setToken(found);
          void submit(found);
        },
      );
      if (activeRef.current) scannerControlsRef.current = controls;
      else controls.stop();
    } catch (reason) {
      const name = reason && typeof reason === 'object' && 'name' in reason ? String(reason.name) : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Camera permission was denied. Allow camera access in your browser settings, then try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera was found on this device. Paste the QR value below instead.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('The camera is already in use by another app. Close it and try again.');
      } else {
        setError(messageOf(reason));
      }
      stopCamera();
    }
  }

  function stopCamera() {
    activeRef.current = false;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => () => {
    activeRef.current = false;
    scannerControlsRef.current?.stop();
  }, []);

  return <main className="auth-utility-page"><header className="public-header"><Link className="brand-lockup" to="/student" aria-label="Campusly home"><BrandLogo className="brand-logo--nav" /></Link><Link to="/student/attendance" className="text-link"><ArrowLeft size={15}/> My attendance</Link></header><section className="auth-utility-card scan-card"><span className="welcome-icon"><QrCode size={22}/></span><span className="form-eyebrow">SESSION CHECK-IN</span><h1>Scan the current QR.</h1><p>Attendance codes rotate every five seconds and only work during the session window.</p>{error && <div className="form-alert" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
    <video ref={videoRef} className={`qr-camera-preview${cameraOn ? ' qr-camera-preview--active' : ' qr-camera-preview--idle'}`} playsInline muted aria-label="QR camera preview"/>
    <div className="scan-actions"><button className="button button--secondary" type="button" onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? <CameraOff size={16}/> : <Camera size={16}/>} {cameraOn ? 'Stop camera' : 'Open camera'}</button></div>
    <form className="tool-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label>Or enter the QR code value<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the current code" autoComplete="off"/></label><button className="button button--primary" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Check in'}</button></form>
    <p className="auth-utility-footnote">If your camera does not work, allow camera access in the browser or paste the current code.</p></section></main>;
}
