import { ipcRenderer } from 'electron';
// createAnswer
// addstream

const desktopCapturer = {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
}

async function getScreenStream() {
  const sources = await desktopCapturer.getSources({types: ['screen']})
  return new Promise((resolve, reject) => {
    navigator.webkitGetUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sources[0].id,
          maxWidth: window.screen.width,
          maxHeight: window.screen.height
        }
      }
    }, (stream) => {
      console.log('add-stream', stream)
      resolve(stream)
    },reject)
  })
}

const pc = new window.RTCPeerConnection({})

pc.ondatachannel = (e) => {
  console.log('datachannel', e)
  e.channel.onmessage = (e) => {
    const { type, data } = JSON.parse(e.data)
    if (type === 'mouse') {
      data.screen = {
        width: window.screen.width,
        height: window.screen.height
      }
    }
    ipcRenderer.send('robot', type, data)
  }
}

pc.onicecandidate = function (e) {
  console.log('candidate', JSON.stringify(e.candidate));
  if (e.candidate) {
    ipcRenderer.send('forward', 'puppet-candidate', JSON.parse(JSON.stringify(e.candidate)))
  }
}

let candidates = []
async function addIceCandidate(candidate) {
  if (candidate) {
    candidates.push(candidate)
  }
  if(pc.remoteDescription && pc.remoteDescription.type) {
      for(let i = 0; i < candidates.length; i ++) {
          await pc.addIceCandidate(new RTCIceCandidate(candidates[i]))
      }
      candidates = []
  } 
}

// window.addIceCandidate = addIceCandidate
ipcRenderer.on('offer', async (e, offer) => {
  const answer = await createAnswer(offer)
  ipcRenderer.send('forward', 'answer', {type: answer.type, sdp: answer.sdp})
})

ipcRenderer.on('candidate', (e, candidate) => {
  addIceCandidate(candidate)
})

async function createAnswer(offer) {
  let screenStream = await getScreenStream()
  pc.addStream(screenStream)
  await pc.setRemoteDescription(offer)
  await pc.setLocalDescription(await pc.createAnswer())
  console.log('answer', JSON.stringify(pc.localDescription))
  return pc.localDescription
}

// window.createAnswer = createAnswer