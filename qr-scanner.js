import './vendor/jsQR.js';

// Frames and QR contents stay in this browser. QR contents are never followed as URLs.
export class LiveQRScanner {
  constructor({video, onState, onCode}) {
    this.video=video; this.onState=onState; this.onCode=onCode;
    this.canvas=document.createElement('canvas');
    this.context=this.canvas.getContext('2d',{willReadFrequently:true});
    this.version=0; this.stream=null; this.timer=null; this.detected=false;
  }
  async start() {
    this.stop();
    const version=this.version;
    this.detected=false;
    if(!navigator.mediaDevices?.getUserMedia){this.onState('unsupported');return;}
    if(typeof globalThis.jsQR!=='function'||!this.context){this.onState('decoder-error');return;}
    this.onState('requesting');
    let stream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'}});
      if(version!==this.version){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;
      this.video.srcObject=stream;
      await this.video.play();
      if(version!==this.version){stream.getTracks().forEach(t=>t.stop());return;}
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
        if(version===this.version){this.stop();this.onState('ended');}
      }));
      this.onState('scanning');
      this.tick(version);
    } catch(error) {
      stream?.getTracks().forEach(t=>t.stop());
      if(version!==this.version)return;
      this.stream=null; this.video.srcObject=null;
      const kind=error.name==='NotAllowedError'?'denied':error.name==='NotFoundError'?'no-camera':error.name==='NotReadableError'?'busy':'error';
      this.onState(kind);
    }
  }
  tick(version) {
    if(version!==this.version||this.detected||!this.stream)return;
    const width=this.video.videoWidth,height=this.video.videoHeight;
    if(width&&height&&this.video.readyState>=2){
      // Match the central alignment square over the 4:3, object-fit:cover preview.
      const visibleWidth=Math.min(width,height*4/3);
      const side=visibleWidth*.72;
      const size=Math.min(640,Math.round(side));
      this.canvas.width=size;this.canvas.height=size;
      try {
        this.context.drawImage(this.video,(width-side)/2,(height-side)/2,side,side,0,0,size,size);
        const frame=this.context.getImageData(0,0,size,size);
        const result=globalThis.jsQR(frame.data,size,size,{inversionAttempts:'attemptBoth'});
        if(result?.data?.length){this.detected=true;this.onState('detected');this.onCode();return;}
      }catch{this.onState('decoder-error');return;}
    }
    this.timer=setTimeout(()=>this.tick(version),250);
  }
  rescan() { if(this.stream){this.detected=false;this.onState('scanning');clearTimeout(this.timer);this.tick(this.version);}else this.start(); }
  stop() {
    this.version++;
    clearTimeout(this.timer);this.timer=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    if(this.video){this.video.pause();this.video.srcObject=null;}
  }
}
