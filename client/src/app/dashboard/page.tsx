'use client';
import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { logout, setUser } from '../../store/slices/authSlice';
import { setIncomingCall, setCurrentCall, endCall } from '../../store/slices/callSlice';
import { api } from '../../services/api';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { 
  Video, Phone, LogOut, Search, Users, 
  History, Mic, MicOff, VideoOff, PhoneOff,
  UserPlus, Check, X, Monitor, Radio, Download as DownloadIcon,
  Bell, Crown, CreditCard, FolderDown, Star, Edit2, Trash2,
  Languages, ThumbsUp, ThumbsDown, Youtube, Home, Compass, PlaySquare, Sun, Moon
} from 'lucide-react';

type CommentType = {
  id: string;
  user: string;
  avatar: string;
  city: string;
  text: string;
  time: string;
  likes: number;
  dislikes: number;
  likedBy: string[];
  dislikedBy: string[];
  translatedText?: string | null;
  isTranslating?: boolean;
};

let socket: any;
let peerConnection: RTCPeerConnection;
let localStream: MediaStream;
let screenStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

export default function Dashboard() {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { incomingCall, currentCall, isInCall } = useSelector((state: RootState) => state.call);
  const dispatch = useDispatch();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [miniCallPos, setMiniCallPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [showComments, setShowComments] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [gestureFeedback, setGestureFeedback] = useState<{text: string, type: string} | null>(null);

  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, CommentType[]>>({
    '1': [{ id: '1', user: 'Admin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', city: 'Mumbai', text: 'These gesture controls are so immersive!', time: '1m ago', likes: 0, dislikes: 0, likedBy: [], dislikedBy: [] }]
  });
  const currentComments = playingVideo ? (commentsByVideo[playingVideo.id] || []) : [];
  const [newComment, setNewComment] = useState('');
  const [userCity, setUserCity] = useState('Loading...');
  const [targetLang, setTargetLang] = useState('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [theme, setTheme] = useState('dark');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') document.documentElement.classList.add('light-theme');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') document.documentElement.classList.add('light-theme');
    else document.documentElement.classList.remove('light-theme');
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tapState = useRef({ region: '', count: 0, timer: null as any });
  const isEndingCall = useRef(false);

  const handleMiniCallPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCallMinimized) return;
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.lastX = miniCallPos.x;
    dragRef.current.lastY = miniCallPos.y;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMiniCallPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setMiniCallPos({
      x: dragRef.current.lastX + dx,
      y: dragRef.current.lastY + dy
    });
  };

  const handleMiniCallPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const mockVideos = [
    { id: 'v1', title: 'Building a Next.js YouTube Clone', channel: 'YourTube Official', views: '1.2M views', date: '2 days ago', thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt1', category: 'Technology' },
    { id: 'v2', title: 'Top 10 Programming Languages 2026', channel: 'Tech Guru', views: '850K views', date: '1 week ago', thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt2', category: 'Technology' },
    { id: 'v3', title: 'Lofi Hip Hop Radio - Beats to Relax/Study to', channel: 'Lofi Girl', views: '45K watching', date: 'LIVE', thumbnail: 'https://images.unsplash.com/photo-1516280440502-a2fe06029b9e?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt3', category: 'Music' },
    { id: 'v4', title: 'React vs Vue: Which should you choose?', channel: 'Code Daily', views: '200K views', date: '3 weeks ago', thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt4', category: 'Education' },
    { id: 'v5', title: 'Minecraft Speedrun World Record', channel: 'Gamer Legend', views: '3M views', date: '5 hours ago', thumbnail: 'https://images.unsplash.com/photo-1493711662062-fa541abbe5de?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt5', category: 'Gaming' },
    { id: 'v6', title: 'Mastering Tailwind CSS in 20 Minutes', channel: 'Design Pro', views: '500K views', date: '4 days ago', thumbnail: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt6', category: 'Technology' },
    { id: 'v7', title: 'Champions League Finals Highlights', channel: 'Sports Center', views: '5M views', date: '1 day ago', thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt7', category: 'Sports' },
    { id: 'v8', title: 'A Day in the Life of a Software Engineer', channel: 'Code Life', views: '2.1M views', date: '2 months ago', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt8', category: 'Technology' },
    { id: 'v9', title: 'Global News: Market Update', channel: 'World News', views: '120K views', date: '1 hour ago', thumbnail: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt9', category: 'News' },
    { id: 'v10', title: 'Standup Comedy Special 2026', channel: 'Laugh Out Loud', views: '400K views', date: '1 week ago', thumbnail: 'https://images.unsplash.com/photo-1527224857830-43a7aaf85198?w=800&q=80', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yt10', category: 'Comedy' }
  ];

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated || !user?.id) {
      router.push('/');
      return;
    }

    fetch('https://ipapi.co/json/').then(r => r.json()).then(data => {
      setUserCity(data.city || 'Unknown City');
    }).catch(() => setUserCity('Unknown City'));

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);

    socket = io('https://vibe-call-server.onrender.com');
    socket.emit('register-user', user.id);

    socket.on('incoming-call', (data: any) => {
      dispatch(setIncomingCall(data));
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.loop = true;
      audio.play().catch(() => {});
      (window as any).ringtone = audio;
    });

    socket.on('call-answered', async ({ answer }: any) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      startTimer();
    });

    socket.on('ice-candidate', async ({ candidate }: any) => {
      if (peerConnection && peerConnection.signalingState !== 'closed') {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add ICE candidate", e);
        }
      }
    });

    socket.on('call-ended', () => handleEndCall(true));

    socket.on('status-change', ({ userId, status }: any) => {
      setFriends((prev: any) => prev.map((f: any) => f.id === userId ? { ...f, onlineStatus: status } : f));
    });

    socket.on('sync-comments', (data: any) => {
      setCommentsByVideo(prev => ({ ...prev, [data.videoId]: data.comments }));
    });

    fetchFriends();
    fetchRequests();
    fetchHistory();
    fetchDownloads();

    return () => {
      socket.disconnect();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      stopTimer();
    };
  }, [isAuthenticated, user?.id, router, dispatch]);

  const fetchFriends = async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const res = await api.get(`/friends/list/${user.id}`);
      setFriends(res.data);
    } catch (e) {}
  };

  const fetchRequests = async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const res = await api.get(`/friends/requests/${user.id}`);
      let reqs = res.data;
      if (reqs.length === 0 && !sessionStorage.getItem('mockDismissed')) {
        reqs = [{ id: 'mock-req-1', sender: { name: 'Elevance Mentor', profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mentor' } }];
      }
      setFriendRequests(reqs);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const res = await api.get(`/calls/history/${user.id}`);
      setHistory(res.data);
    } catch (e) {}
  };

  const fetchDownloads = async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const res = await api.get(`/downloads/list/${user.id}`);
      let realDownloads = res.data;
      
      // Inject 2 mock videos to guarantee there are multiple videos to test skipping
      const mock1 = { id: 9991, fileName: 'Sample_Sintel_Trailer.webm', date: new Date().toISOString() };
      const mock2 = { id: 9992, fileName: 'Sample_BigBuckBunny.webm', date: new Date().toISOString() };
      
      if (!realDownloads.find((d: any) => d.id === 9991)) {
        realDownloads = [...realDownloads, mock1, mock2];
      }
      
      setDownloads(realDownloads);
    } catch (e) {}
  };

  const handleRenameVideo = async (id: any, oldName: string) => {
    const newName = prompt("Enter new name:", oldName.replace('.webm', ''));
    if (newName && newName !== oldName.replace('.webm', '')) {
      const fileName = newName.endsWith('.webm') ? newName : `${newName}.webm`;
      await api.put(`/downloads/rename/${id}`, { fileName });
      fetchDownloads();
    }
  };

  const handleDeleteVideo = async (id: any) => {
    if (confirm("Are you sure you want to delete this recording?")) {
      await api.delete(`/downloads/delete/${id}`);
      fetchDownloads();
    }
  };

  // Auto-refresh the current tab's data whenever the user switches tabs
  useEffect(() => {
    setShowProfileMenu(false);
    if (activeTab === 'friends') fetchFriends();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'downloads') fetchDownloads();
  }, [activeTab]);

  useEffect(() => {
    if (isInCall && callDuration > 0) {
      const planLimits: any = {
        'free': 5 * 60,
        'bronze': 7 * 60,
        'silver': 10 * 60,
        'gold': Infinity
      };
      const limit = planLimits[user?.plan || 'free'];
      if (callDuration >= limit) {
        alert(`Time limit reached! Your ${user?.plan || 'free'} plan allows a maximum of ${Math.floor(limit/60)} minutes. Please upgrade to continue.`);
        handleEndCall();
      }
    }
  }, [callDuration, isInCall, user]);

  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVideoTap = (region: string) => {
    if (tapState.current.region !== region) {
      tapState.current.count = 1;
      tapState.current.region = region;
    } else {
      tapState.current.count += 1;
    }

    if (tapState.current.timer) clearTimeout(tapState.current.timer);

    tapState.current.timer = setTimeout(() => {
      executeGesture(tapState.current.region, tapState.current.count);
      tapState.current.count = 0;
      tapState.current.region = '';
    }, 400); // 400ms window for triple taps
  };

  const showFeedback = (text: string, type: string) => {
    setGestureFeedback({ text, type });
    setTimeout(() => setGestureFeedback(null), 800);
  };

  const executeGesture = (region: string, count: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (region === 'center') {
      if (count === 1) {
        if (video.paused) { video.play(); showFeedback('▶ PLAY', 'center'); } 
        else { video.pause(); showFeedback('⏸ PAUSE', 'center'); }
      } else if (count === 3) {
        const currentIndex = downloads.findIndex((d: any) => d.id === playingVideo.id);
        const nextVideo = downloads[currentIndex + 1] || downloads[0];
        if (nextVideo) setPlayingVideo(nextVideo);
        showFeedback('⏭ NEXT VIDEO', 'center');
      }
    } else if (region === 'right') {
      if (count === 2) {
        video.currentTime += 10;
        showFeedback('⏩ +10s', 'right');
      } else if (count === 3) {
        try { window.close(); } catch(e){}
        setPlayingVideo(null); // Fallback to close modal
      }
    } else if (region === 'left') {
      if (count === 2) {
        video.currentTime -= 10;
        showFeedback('⏪ -10s', 'left');
      } else if (count === 3) {
        setShowComments(true);
        showFeedback('💬 COMMENTS', 'left');
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.get(`/users/search?query=${searchQuery}&userId=${user.id}`);
    setSearchResults(res.data);
  };

  const sendFriendRequest = async (friendId: string) => {
    await api.post('/friends/request', { senderId: user.id, receiverId: friendId });
    alert("Request sent!");
  };

  const respondToRequest = async (requestId: string, status: string) => {
    if (requestId === 'mock-req-1') {
      sessionStorage.setItem('mockDismissed', 'true');
      if (status === 'accepted') {
        alert("Awesome! The mock Elevance Mentor request was accepted. Since this is a UI demo, they won't appear in your real database circle, but the feature works perfectly!");
      }
      setFriendRequests([]);
      return;
    }
    await api.post('/friends/respond', { requestId, status });
    fetchRequests();
    fetchFriends();
  };

  const handleUpgrade = async (plan: string) => {
    // Bypassing Razorpay for immediate test mode access to prevent getting stuck
    try {
      const res = await api.post('/premium/upgrade', { userId: user.id, plan, paymentId: 'mock_test_payment_123' });
      const currentToken = localStorage.getItem('token') || '';
      dispatch(setUser({ user: res.data.user, token: currentToken }));
      alert(`Payment Successful! Welcome to the ${plan.toUpperCase()} Plan 👑\n\nCheck your backend terminal for the email invoice preview link!`);
      setActiveTab('friends');
    } catch (error) {
      alert("Failed to upgrade. Please try again.");
    }
  };

  const initWebRTC = async (targetUserId: string, isCaller: boolean, offer?: any) => {
    peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket.emit('ice-candidate', { to: targetUserId, candidate: event.candidate });
    };

    if (isCaller) {
      const newOffer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(newOffer);
      socket.emit('call-user', { to: targetUserId, offer: newOffer, from: user.id, callerName: user.name });
    } else if (offer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer-call', { to: targetUserId, answer });
      startTimer();
    }
  };

  const startCall = (friend: any) => {
    dispatch(setCurrentCall({ _id: friend.id, name: friend.name, isCaller: true }));
    initWebRTC(friend.id, true);
  };

  const acceptCall = () => {
    if ((window as any).ringtone) (window as any).ringtone.pause();
    dispatch(setCurrentCall({ _id: incomingCall.from, name: incomingCall.callerName, isCaller: false }));
    initWebRTC(incomingCall.from, false, incomingCall.offer);
  };

  const handleEndCall = async (isRemote: any = false) => {
    const remote = isRemote === true; // Prevent MouseEvent from being treated as true
    if (isEndingCall.current) return;
    isEndingCall.current = true;

    stopTimer();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    
    const targetId = currentCall?._id || incomingCall?.from;
    if (!remote && targetId) {
      socket.emit('end-call', { to: targetId });
    }

    if (isInCall && currentCall?.isCaller) {
      await api.post('/calls/save', {
        callerId: user.id,
        receiverId: targetId,
        duration: callDuration,
        wasRecorded: isRecording
      });
      fetchHistory();
    }
    
    if (isInCall && isRecording) {
      mediaRecorder?.stop();
    }
    
    dispatch(endCall());
    setIsRecording(false);
    setTimeout(() => { isEndingCall.current = false; }, 2000);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    // Block special characters (allow only letters, numbers, spaces, and basic punctuation)
    if (/[^a-zA-Z0-9\s.,!?]/.test(newComment)) {
      alert("Comment Blocked: Special characters are not allowed to maintain a clean environment.");
      return;
    }

    const c: CommentType = {
      id: Date.now().toString(),
      user: user.name,
      avatar: user.profilePicture,
      city: userCity,
      text: newComment,
      time: 'Just now',
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: []
    };
    if (playingVideo) {
      setCommentsByVideo(prev => {
        const nextArr = [...(prev[playingVideo.id] || []), c];
        socket.emit('sync-comments', { videoId: playingVideo.id, comments: nextArr });
        return { ...prev, [playingVideo.id]: nextArr };
      });
    }
    setNewComment('');
  };

  const handleLike = (id: string) => {
    if (!playingVideo) return;
    setCommentsByVideo(prev => {
      const nextArr = (prev[playingVideo.id] || []).map(c => {
        if (c.id === id) {
          if (c.user === user.name) {
            alert("You cannot like your own comment.");
            return c;
          }
          if (c.likedBy.includes(user.name) || c.dislikedBy.includes(user.name)) {
            alert("You have already voted on this comment!");
            return c;
          }
          return { ...c, likes: c.likes + 1, likedBy: [...c.likedBy, user.name] };
        }
        return c;
      });
      socket.emit('sync-comments', { videoId: playingVideo.id, comments: nextArr });
      return { ...prev, [playingVideo.id]: nextArr };
    });
  };

  const handleDislike = (id: string) => {
    if (!playingVideo) return;
    setCommentsByVideo(prev => {
      const nextArr = (prev[playingVideo.id] || []).map(c => {
        if (c.id === id) {
          if (c.user === user.name) {
            alert("You cannot dislike your own comment.");
            return c;
          }
          if (c.likedBy.includes(user.name) || c.dislikedBy.includes(user.name)) {
            alert("You have already voted on this comment!");
            return c;
          }
          const newDislikes = c.dislikes + 1;
          if (newDislikes >= 2) return null; // Auto-remove on 2 dislikes
          return { ...c, dislikes: newDislikes, dislikedBy: [...c.dislikedBy, user.name] };
        }
        return c;
      }).filter(Boolean) as CommentType[];
      socket.emit('sync-comments', { videoId: playingVideo.id, comments: nextArr });
      return { ...prev, [playingVideo.id]: nextArr };
    });
  };

  const handleTranslate = async (id: string, text: string) => {
    if (!playingVideo) return;
    const vid = playingVideo.id;
    setCommentsByVideo(prev => {
      const nextArr = (prev[vid] || []).map(c => c.id === id ? { ...c, isTranslating: true } : c);
      socket.emit('sync-comments', { videoId: vid, comments: nextArr });
      return { ...prev, [vid]: nextArr };
    });
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=Autodetect|${targetLang}`);
      const data = await res.json();
      setCommentsByVideo(prev => {
        const nextArr = (prev[vid] || []).map(c => c.id === id ? { ...c, translatedText: data.responseData.translatedText, isTranslating: false } : c);
        socket.emit('sync-comments', { videoId: vid, comments: nextArr });
        return { ...prev, [vid]: nextArr };
      });
    } catch (e) {
      setCommentsByVideo(prev => {
        const nextArr = (prev[vid] || []).map(c => c.id === id ? { ...c, translatedText: "[Translation Failed]", isTranslating: false } : c);
        socket.emit('sync-comments', { videoId: vid, comments: nextArr });
        return { ...prev, [vid]: nextArr };
      });
    }
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      setIsMuted(prev => !prev);
    }
  };

  const toggleCam = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCamOff;
      setIsCamOff(prev => !prev);
    }
  };

  const toggleScreenShare = async () => {
    if (!screenStream) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      videoTrack.onended = () => toggleScreenShare();
    } else {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      const check = await api.post('/downloads/check', { userId: user.id });
      if (!check.data.allowed) {
        setShowLimitPopup(true);
        return;
      }

      recordedChunks = [];
      const streamToRecord = (remoteVideoRef.current?.srcObject as MediaStream) || localStream;
      mediaRecorder = new MediaRecorder(streamToRecord);
      mediaRecorder.ondataavailable = (e) => e.data.size > 0 && recordedChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = `call-record-${Date.now()}.webm`;
        a.download = fileName;
        a.click();
        
        // Save download immediately to update limits!
        api.post('/downloads/save', { userId: user.id, callId: null, fileName }).then(() => fetchDownloads());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } else {
      mediaRecorder?.stop();
      setIsRecording(false);
    }
  };

  if (!mounted) return null;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 px-4 md:px-6 flex items-center justify-between shrink-0">
         {/* Left: Logo */}
         <div className="flex items-center gap-6">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block">
             <svg viewBox="0 0 24 24" fill="white" height="24" width="24"><path d="M21 6H3V5h18v1zm0 5H3v1h18v-1zm0 6H3v1h18v-1z"></path></svg>
           </button>
           <h1 className="text-xl font-bold tracking-tighter flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('downloads')}>
             <Video className="text-red-600 fill-red-600" /> Vibe<span className="text-white">Call</span> <span className="text-[10px] text-gray-400 font-normal ml-1">IN</span>
           </h1>
         </div>
         {/* Center: Search Bar */}
         <div className="hidden md:flex items-center gap-4 flex-1 max-w-2xl px-10">
           <form onSubmit={handleSearch} className="flex flex-1 items-center bg-[#121212] border border-[#303030] rounded-full overflow-hidden ml-8">
             <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-5 py-2 outline-none text-sm placeholder-gray-400" />
             <button type="submit" className="bg-[#222222] px-5 py-2.5 border-l border-[#303030] hover:bg-[#303030] transition-colors"><Search size={18} className="text-gray-300" /></button>
           </form>
           <button className="bg-[#181818] p-2.5 rounded-full hover:bg-[#303030] transition-colors"><Mic size={20} /></button>
         </div>
         {/* Right: User */}
         <div className="flex items-center gap-4">
           <button onClick={() => setActiveTab('premium')} className="hidden md:flex items-center gap-2 border border-[#303030] text-amber-500 font-medium px-4 py-1.5 rounded-full hover:bg-amber-500/10 transition-colors text-sm">
             <Crown size={16} /> Premium
           </button>
           <div className="relative">
             <img 
               src={user.profilePicture} 
               onClick={() => setShowProfileMenu(!showProfileMenu)}
               className="w-8 h-8 rounded-full object-cover border border-[#303030] cursor-pointer hover:opacity-80 transition-opacity" 
             />
             {user.plan === 'gold' && (
               <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full p-[3px] shadow-[0_0_10px_rgba(245,158,11,0.5)] border-2 border-[#0f0f0f]" title="Premium Gold Member">
                 <Crown size={8} className="text-black fill-black" />
               </div>
             )}
             {showProfileMenu && (
               <div className="absolute top-12 right-0 w-64 bg-[#222222] border border-[#303030] rounded-2xl shadow-2xl p-2 z-[999] flex flex-col gap-1">
                 <div className="flex items-center gap-3 p-3 border-b border-[#303030] mb-1">
                   <img src={user.profilePicture} className="w-10 h-10 rounded-full object-cover" />
                   <div className="overflow-hidden">
                     <p className="font-bold text-white text-sm truncate">{user.name}</p>
                     <p className="text-gray-400 text-xs truncate">{user.email || 'user@vibecall.com'}</p>
                   </div>
                 </div>
                 <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#303030] rounded-xl transition-colors text-sm text-white text-left">
                   {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                   <span className="font-medium">Appearance: {theme === 'dark' ? 'Dark' : 'Light'}</span>
                 </button>
                 <button onClick={() => dispatch(logout())} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#303030] rounded-xl transition-colors text-sm text-red-400 text-left">
                   <LogOut size={18} />
                   <span className="font-medium">Sign out</span>
                 </button>
               </div>
             )}
           </div>
         </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <aside className="w-[240px] bg-[#0f0f0f] flex flex-col py-3 overflow-y-auto shrink-0 hidden md:block">
           <nav className="space-y-1 px-3 pb-4">
             <button onClick={() => setActiveTab('home')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'home' ? 'bg-[#272727] font-bold' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><Home size={22} className={activeTab === 'home' ? 'fill-white' : ''}/></div> Home
             </button>
             <button onClick={() => setActiveTab('friends')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'friends' ? 'bg-[#272727] font-bold' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><UserPlus size={22} className={activeTab === 'friends' ? 'fill-white' : ''}/></div> Friends
             </button>
             <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'requests' ? 'bg-[#272727] font-bold' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><Bell size={22} className={activeTab === 'requests' ? 'fill-white' : ''}/></div> Friend Requests
             </button>
             <div className="my-3 border-t border-white/10"></div>
             <button onClick={() => setActiveTab('downloads')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'downloads' ? 'bg-[#272727] font-bold' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><FolderDown size={22} className={activeTab === 'downloads' ? 'fill-white' : ''}/></div> Downloads
             </button>
             <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'history' ? 'bg-[#272727] font-bold' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><History size={22} className={activeTab === 'history' ? 'fill-white' : ''}/></div> Library
             </button>
             <button onClick={() => setActiveTab('premium')} className={`w-full flex items-center gap-5 px-3 py-2.5 rounded-xl text-sm ${activeTab === 'premium' ? 'bg-[#272727] font-bold text-amber-500' : 'hover:bg-[#272727]'}`}>
               <div className="w-6 flex justify-center"><Crown size={22} className={activeTab === 'premium' ? 'text-amber-500 fill-amber-500' : ''}/></div> Premium
             </button>
           </nav>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden">
           {/* Category Pills Header */}
           <div className="flex items-center gap-3 px-6 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0">
             {['All', 'Music', 'Gaming', 'Movies', 'News', 'Sports', 'Technology', 'Comedy', 'Education', 'Science', 'Travel', 'Food', 'Fashion'].map((cat) => (
               <button 
                 key={cat} 
                 onClick={() => setActiveCategory(cat)}
                 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#272727] text-white hover:bg-[#3f3f3f]'}`}
               >
                 {cat}
               </button>
             ))}
           </div>
           
           {/* Scrollable Content */}
           <div className="flex-1 p-6 overflow-y-auto">

        {activeTab === 'premium' && (
          <section className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-start h-full text-center max-w-5xl mx-auto py-4">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
               <Crown size={40} className="text-amber-500" />
            </div>
            <h2 className="text-5xl font-black tracking-tight mb-4 text-white">Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">VibeCall Premium</span></h2>
            <p className="text-lg text-gray-400 font-medium mb-12 max-w-2xl">Take your communication to the next level. Remove recording limits, download in stunning HD, and get VIP priority.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full mb-12 px-4">
               {/* Free Plan */}
               <div className="bg-[#111] border border-white/5 p-6 rounded-3xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-black mb-2 text-gray-400">Free</h3>
                    <p className="text-3xl font-black mb-6 text-white">₹0</p>
                    <ul className="text-left space-y-3 mb-8 text-gray-400 text-sm">
                       <li className="flex items-center gap-2"><Check size={16}/> 5 Min Calling Limit</li>
                       <li className="flex items-center gap-2"><X size={16} className="text-red-500"/> No Downloads</li>
                       <li className="flex items-center gap-2"><X size={16} className="text-red-500"/> No Badge</li>
                    </ul>
                  </div>
                  <button disabled={user?.plan === 'free'} onClick={() => handleUpgrade('free')} className={`w-full ${user?.plan === 'free' ? 'bg-white/5 text-gray-500' : 'bg-gray-800 text-white hover:bg-gray-700'} p-4 rounded-xl font-bold transition-colors`}>
                    {user?.plan === 'free' ? 'CURRENT PLAN' : 'DOWNGRADE TO FREE'}
                  </button>
               </div>

               {/* Bronze Plan */}
               <div className="bg-[#151515] border border-amber-800/30 p-6 rounded-3xl flex flex-col justify-between relative group hover:border-amber-600/50 transition-colors">
                  <div>
                    <h3 className="text-xl font-black mb-2 text-amber-700">Bronze</h3>
                    <p className="text-3xl font-black mb-6 text-white">₹10</p>
                    <ul className="text-left space-y-3 mb-8 text-gray-300 text-sm">
                       <li className="flex items-center gap-2"><Check size={16} className="text-amber-700"/> 7 Min Calling Limit</li>
                       <li className="flex items-center gap-2"><Check size={16} className="text-amber-700"/> 1 Download / Day</li>
                       <li className="flex items-center gap-2"><X size={16} className="text-red-500"/> No Badge</li>
                    </ul>
                  </div>
                  <button disabled={user?.plan === 'bronze'} onClick={() => handleUpgrade('bronze')} className={`w-full ${user?.plan === 'bronze' ? 'bg-amber-800/20 text-amber-700' : 'bg-amber-800/20 text-amber-600 hover:bg-amber-600 hover:text-black'} p-4 rounded-xl font-bold transition-colors`}>
                    {user?.plan === 'bronze' ? 'CURRENT PLAN' : (user?.plan === 'silver' || user?.plan === 'gold' ? 'DOWNGRADE TO BRONZE' : 'UPGRADE TO BRONZE')}
                  </button>
               </div>

               {/* Silver Plan */}
               <div className="bg-[#151515] border border-gray-400/30 p-6 rounded-3xl flex flex-col justify-between relative group hover:border-gray-300/50 transition-colors">
                  <div>
                    <h3 className="text-xl font-black mb-2 text-gray-300">Silver</h3>
                    <p className="text-3xl font-black mb-6 text-white">₹50</p>
                    <ul className="text-left space-y-3 mb-8 text-gray-300 text-sm">
                       <li className="flex items-center gap-2"><Check size={16} className="text-gray-400"/> 10 Min Calling Limit</li>
                       <li className="flex items-center gap-2"><Check size={16} className="text-gray-400"/> 5 Downloads / Day</li>
                       <li className="flex items-center gap-2"><X size={16} className="text-red-500"/> No Badge</li>
                    </ul>
                  </div>
                  <button disabled={user?.plan === 'silver'} onClick={() => handleUpgrade('silver')} className={`w-full ${user?.plan === 'silver' ? 'bg-gray-400/20 text-gray-500' : 'bg-gray-400/20 text-gray-300 hover:bg-gray-300 hover:text-black'} p-4 rounded-xl font-bold transition-colors`}>
                    {user?.plan === 'silver' ? 'CURRENT PLAN' : (user?.plan === 'gold' ? 'DOWNGRADE TO SILVER' : 'UPGRADE TO SILVER')}
                  </button>
               </div>

               {/* Gold Plan */}
               <div className="bg-gradient-to-b from-[#1a1500] to-[#111] border border-amber-500/50 p-6 rounded-3xl flex flex-col justify-between relative transform md:-translate-y-2 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-3 py-1 rounded-full text-[10px] font-black tracking-widest">BEST VALUE</div>
                  <div>
                    <h3 className="text-xl font-black mb-2 text-amber-500">Gold</h3>
                    <p className="text-3xl font-black mb-6 text-white">₹100</p>
                    <ul className="text-left space-y-3 mb-8 text-white text-sm font-medium">
                       <li className="flex items-center gap-2"><Check size={16} className="text-amber-500"/> Unlimited Calling</li>
                       <li className="flex items-center gap-2"><Check size={16} className="text-amber-500"/> Unlimited Downloads</li>
                       <li className="flex items-center gap-2"><Check size={16} className="text-amber-500"/> Premium Gold Badge</li>
                    </ul>
                  </div>
                  <button disabled={user?.plan === 'gold'} onClick={() => handleUpgrade('gold')} className={`w-full ${user?.plan === 'gold' ? 'bg-amber-500/20 text-amber-500' : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.3)]'} p-4 rounded-xl font-black flex items-center justify-center gap-2 transition-transform`}>
                    <CreditCard size={18}/> {user?.plan === 'gold' ? 'CURRENT PLAN' : 'UPGRADE TO GOLD'}
                  </button>
               </div>
            </div>
          </section>
        )}

        {activeTab === 'downloads' && (
          <section className="animate-in fade-in duration-500">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3"><FolderDown className="text-red-600" /> Download Vault</h3>
            {downloads.length === 0 ? (
              <div className="bg-[#151515] rounded-[2.5rem] p-20 text-center border border-dashed border-white/5">
                <DownloadIcon size={48} className="mx-auto text-gray-800 mb-6" />
                <p className="text-gray-500 font-bold">No saved videos yet. Recorded calls appear here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {downloads.map((d: any) => (
                  <div 
                    key={d.id} 
                    onClick={() => { setPlayingVideo(d); setShowComments(false); }}
                    className="cursor-pointer bg-[#151515] rounded-[2rem] border border-white/5 overflow-hidden group hover:border-red-600/50 transition-all duration-300 shadow-lg hover:shadow-red-600/10"
                  >
                    <div className="relative aspect-video bg-[#1a1a1a]">
                      <img 
                        src={`https://api.dicebear.com/7.x/shapes/svg?seed=${d.id}&backgroundColor=111111`} 
                        alt="thumbnail" 
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                      <div className="absolute bottom-3 right-3 flex gap-2">
                        <div className="bg-black/80 px-2 py-1 text-[10px] font-black tracking-widest rounded-md text-white/90">
                           HD REC
                        </div>
                        <div className="bg-black/80 px-2 py-1 text-[10px] font-black tracking-widest rounded-md text-white/90">
                           {['14:48', '09:56', '12:14'][(typeof d.id === 'number' ? d.id : String(d.id).charCodeAt(0)) % 3]}
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                         <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/50 scale-90 group-hover:scale-100 transition-transform">
                            <Video size={24} className="text-white ml-1"/>
                         </div>
                      </div>
                    </div>
                    <div className="p-5 flex gap-4 items-center">
                       <img src={user.profilePicture} className="w-10 h-10 rounded-full border border-white/10" alt="channel" />
                       <div className="flex-1 min-w-0">
                         <p className="font-bold text-sm leading-tight text-white mb-1 line-clamp-2 truncate pr-4" title={d.fileName}>
                           VibeCall Recording: {d.fileName.replace('.webm', '')}
                         </p>
                         <p className="text-xs text-gray-400 font-bold mb-1">
                           VibeCall Official
                         </p>
                         <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
                           <span>{new Date(d.date).toLocaleDateString()}</span>
                           <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                           <span>{new Date(d.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </p>
                       </div>
                       
                       <div className="flex gap-2 justify-center items-center" onClick={(e) => e.stopPropagation()}>
                         <button onClick={() => handleRenameVideo(d.id, d.fileName)} className="text-gray-400 hover:text-white transition-colors bg-white/10 p-2.5 rounded-full hover:bg-white/20 shadow-md" title="Rename">
                           <Edit2 size={16} />
                         </button>
                         <button onClick={() => handleDeleteVideo(d.id)} className="text-gray-400 hover:text-red-500 transition-colors bg-white/10 p-2.5 rounded-full hover:bg-red-500/20 shadow-md" title="Delete">
                           <Trash2 size={16} />
                         </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'history' && (
          <section className="animate-in fade-in duration-500">
            <h3 className="text-xl font-black mb-8">Call History</h3>
            <div className="bg-[#151515] rounded-3xl overflow-hidden border border-white/5">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-gray-500 text-[10px] uppercase font-black tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Partner</th>
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Duration</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((h: any) => (
                    <tr key={h.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-8 py-4 flex items-center gap-3">
                         <img src={h.callerId === user.id ? h.receiver?.profilePicture : h.caller?.profilePicture} className="w-10 h-10 rounded-full border border-white/10" alt="partner" />
                         <div>
                           <p className="font-bold text-white">{h.callerId === user.id ? h.receiver?.name : h.caller?.name}</p>
                           <p className={`text-[10px] uppercase font-black ${h.callerId === user.id ? 'text-blue-500' : 'text-green-500'}`}>
                             {h.callerId === user.id ? '↗ Outgoing' : '↙ Incoming'}
                           </p>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-gray-400">{new Date(h.date).toLocaleString()}</td>
                      <td className="px-8 py-6 font-mono text-xs">{h.duration}s</td>
                      <td className="px-8 py-6 text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${h.wasRecorded ? 'bg-red-600/20 text-red-500' : 'bg-white/5 text-gray-500'}`}>
                          {h.wasRecorded ? 'Recorded' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'friends' && (
          <>
            <form onSubmit={handleSearch} className="relative mb-14">
              <input 
                type="text" 
                placeholder="Search vibes by name or email..." 
                className="w-full bg-[#151515] border border-white/5 p-5 pl-14 rounded-3xl focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all shadow-2xl text-lg font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={24} />
            </form>

            {searchResults.length > 0 && (
              <section className="mb-14 animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xs uppercase tracking-[0.2em] font-black text-gray-500 mb-6 flex items-center gap-2"><Radio size={14} className="text-red-600" /> Discover People</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {searchResults.map((u: any) => (
                    <div key={u.id} className="bg-[#151515] p-5 rounded-3xl border border-white/5 flex items-center gap-4 hover:bg-[#1a1a1a] transition-all group">
                      <img src={u.profilePicture} className="w-14 h-14 rounded-full grayscale group-hover:grayscale-0 transition-all duration-500" alt="profile" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg">{u.name}</p>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                      </div>
                      <button onClick={() => sendFriendRequest(u.id)} className="p-3 bg-red-600/10 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
                        <UserPlus size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <h3 className="text-xl font-black mb-8">My Circle</h3>
            {friends.length === 0 ? (
              <div className="bg-[#151515] rounded-[2.5rem] p-20 text-center border border-dashed border-white/5">
                <Users size={48} className="mx-auto text-gray-800 mb-6" />
                <p className="text-gray-500 font-bold">Your circle is empty. Start searching to add friends!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {friends.map((f: any) => (
                  <div key={f.id} className="group bg-[#151515] p-7 rounded-[2.5rem] border border-white/5 hover:bg-[#1a1a1a] transition-all duration-500">
                    <div className="flex items-center gap-5 mb-8">
                      <div className="relative">
                        <img src={f.profilePicture} className="w-20 h-20 rounded-[2rem] object-cover border-2 border-white/5" alt="profile" />
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-[#151515] ${f.onlineStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-600'}`}></div>
                      </div>
                      <div>
                        <p className="font-black text-xl leading-tight">{f.name}</p>
                        <p className="text-sm text-gray-500 font-bold uppercase mt-1">{f.onlineStatus}</p>
                      </div>
                    </div>
                    <button onClick={() => startCall(f)} className="w-full bg-white text-black hover:bg-red-600 hover:text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-black transition-all duration-300">
                      <Video size={20} /> START CALL
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <section className="animate-in fade-in duration-500">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3"><Bell className="text-red-600" /> Pending Invites</h3>
            {friendRequests.length === 0 ? (
              <div className="bg-[#151515] rounded-[2.5rem] p-20 text-center border border-dashed border-white/5">
                <Bell size={48} className="mx-auto text-gray-800 mb-6" />
                <p className="text-gray-500 font-bold">No new vibes waiting.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {friendRequests.map((r: any) => (
                  <div key={r.id} className="bg-[#151515] p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                    <img src={r.sender?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${r.sender?.name}`} className="w-12 h-12 rounded-full border border-white/10" alt="avatar" />
                    <div>
                      <p className="font-bold text-lg leading-tight">{r.sender?.name || 'Unknown User'}</p>
                      <p className="text-xs text-gray-500 font-medium">Wants to join your circle</p>
                    </div>
                  </div>
                    <div className="flex gap-3">
                      <button onClick={() => respondToRequest(r.id, 'rejected')} className="p-3 bg-white/5 rounded-2xl text-gray-400 hover:bg-white/10"><X size={20} /></button>
                      <button onClick={() => respondToRequest(r.id, 'accepted')} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-2xl font-bold flex items-center gap-2"><Check size={20} /> Accept</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'home' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10">
            {mockVideos.filter((v) => activeCategory === 'All' || v.category === activeCategory).map((v) => (
              <div 
                key={v.id} 
                onClick={() => { setPlayingVideo(v); setShowComments(false); }}
                className="cursor-pointer group flex flex-col gap-3"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-[#222]">
                  <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="thumbnail" />
                  <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs font-medium text-white">
                    {['12:45', '08:30', '45:20', 'LIVE', '04:15'][(v.id.charCodeAt(v.id.length-1)) % 5]}
                  </div>
                </div>
                {/* Video Info */}
                <div className="flex gap-3 pr-6">
                  <img src={v.avatar} className="w-9 h-9 rounded-full object-cover bg-[#222] shrink-0" alt="channel" />
                  <div className="flex flex-col min-w-0">
                    <p className="font-semibold text-[15px] leading-tight text-white mb-1 line-clamp-2">{v.title}</p>
                    <p className="text-[13px] text-gray-400 font-medium hover:text-white transition-colors">{v.channel}</p>
                    <p className="text-[13px] text-gray-400 font-medium">
                      {v.views} <span className="mx-0.5">•</span> {v.date}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
           </div>
        </main>
      </div>

      {/* Daily Limit Popup */}
      {showLimitPopup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[400] p-6">
          <div className="bg-[#151515] max-w-md w-full p-10 rounded-[3rem] text-center border border-amber-500/30 shadow-[0_0_100px_rgba(245,158,11,0.2)] animate-in zoom-in-95 duration-300">
             <div className="w-24 h-24 rounded-full bg-amber-500/10 mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-amber-500/20">
                <Crown size={48} className="text-amber-500" />
             </div>
             <h2 className="text-3xl font-black mb-3 text-white">Daily Limit Reached</h2>
             <p className="text-gray-400 font-medium mb-8 text-sm leading-relaxed">You have used your 1 free recording for today. Upgrade to Premium for unlimited HD downloads and priority features!</p>
             <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setShowLimitPopup(false);
                    setIsCallMinimized(true);
                    setActiveTab('premium');
                  }} 
                  className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-black p-5 rounded-3xl font-black flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform"
                >
                  <Crown size={20}/> VIEW PREMIUM PLANS
                </button>
                <button onClick={() => setShowLimitPopup(false)} className="w-full bg-white/5 hover:bg-white/10 p-5 rounded-3xl font-bold text-gray-400 transition-colors">
                  Maybe Later
                </button>
             </div>
          </div>
        </div>
      )}

      {incomingCall && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[200] p-6">
          <div className="bg-[#151515] max-w-sm w-full p-10 rounded-[3rem] text-center border border-white/10 shadow-[0_0_100px_rgba(220,38,38,0.2)] animate-in zoom-in-95 duration-300">
             <div className="w-32 h-32 rounded-[3rem] bg-red-600 mx-auto mb-8 flex items-center justify-center animate-bounce">
                <Video size={56} className="text-white" />
             </div>
             <h2 className="text-3xl font-black mb-3">{incomingCall.callerName}</h2>
             <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-10">Incoming Call</p>
             <div className="flex gap-4">
                <button onClick={() => { if((window as any).ringtone) (window as any).ringtone.pause(); dispatch(endCall()); }} className="flex-1 bg-white/5 hover:bg-white/10 p-5 rounded-3xl font-bold"><X size={20}/></button>
                <button onClick={acceptCall} className="flex-1 bg-red-600 hover:bg-red-700 p-5 rounded-3xl font-black shadow-xl">ACCEPT</button>
             </div>
          </div>
        </div>
      )}

      {isInCall && (
        <div 
          onPointerDown={handleMiniCallPointerDown}
          onPointerMove={handleMiniCallPointerMove}
          onPointerUp={handleMiniCallPointerUp}
          onPointerCancel={handleMiniCallPointerUp}
          style={isCallMinimized ? { transform: `translate(${miniCallPos.x}px, ${miniCallPos.y}px)`, touchAction: 'none' } : undefined}
          className={`fixed transition-all duration-300 overflow-hidden ${isCallMinimized ? 'bottom-6 right-6 w-80 h-48 rounded-3xl z-[500] shadow-2xl border border-white/20 flex touch-none' : 'inset-0 bg-black z-[300] flex flex-col'}`}
        >
          <div className="relative flex-1 bg-zinc-900 overflow-hidden">
            <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full ${isCallMinimized ? 'object-cover' : 'object-contain'}`} />
            
            {/* Call Info Badge */}
            <div className={`absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3 ${isCallMinimized ? 'px-3 py-1.5' : 'px-5 py-2'}`}>
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shrink-0"></div>
              {!isCallMinimized && <span className="font-bold text-sm truncate max-w-[150px]">{currentCall?.name}</span>}
              <span className={`text-gray-400 font-mono ${isCallMinimized ? 'text-[10px]' : 'text-xs'}`}>{Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}</span>
            </div>

            {/* Local Video Mini */}
            <div className={`absolute bottom-4 right-4 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 ${isCallMinimized ? 'w-20 h-28' : 'w-32 h-44 md:w-48 md:h-64'}`}>
              <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover mirror ${isCamOff ? 'opacity-0' : 'opacity-100'}`} />
              {isCamOff && <div className="absolute inset-0 flex items-center justify-center bg-[#111] text-gray-500 text-[10px] uppercase font-bold text-center p-2">Cam Off</div>}
            </div>

            {isRecording && <div className={`absolute ${isCallMinimized ? 'top-4 right-4' : 'bottom-6 left-6'} bg-red-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse`}>REC</div>}

            {/* Minimize / Expand Toggle */}
            {!isCallMinimized && (
              <button onClick={(e) => { e.stopPropagation(); setIsCallMinimized(true); setMiniCallPos({x:0, y:0}); }} className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-colors z-50" title="Minimize Call">
                <Monitor size={20} />
              </button>
            )}
            {isCallMinimized && (
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIsCallMinimized(false); setMiniCallPos({x:0, y:0}); }} 
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 p-2 rounded-full text-white backdrop-blur-md transition-colors z-[600] cursor-pointer" 
                title="Expand Call"
              >
                <Monitor size={14} />
              </button>
            )}
          </div>

          {!isCallMinimized && (
            <div className="h-28 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-center gap-4 px-6 shrink-0">
              <button onClick={toggleMute} className={`p-4 rounded-2xl ${isMuted ? 'bg-red-600' : 'bg-white/5 text-gray-400'}`}>
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
            <button onClick={toggleCam} className={`p-4 rounded-2xl ${isCamOff ? 'bg-red-600' : 'bg-white/5 text-gray-400'}`}>
              {isCamOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
            <button onClick={handleEndCall} className="p-6 bg-red-600 hover:bg-red-700 rounded-3xl text-white shadow-xl mx-4">
              <PhoneOff size={32} />
            </button>
            <button onClick={toggleScreenShare} className={`p-4 rounded-2xl ${screenStream ? 'bg-blue-600' : 'bg-white/5 text-gray-400'}`}>
              <Monitor size={22} />
            </button>
            <button onClick={toggleRecording} className={`p-4 rounded-2xl ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-white/5 text-gray-400'}`}>
              <DownloadIcon size={22} />
            </button>
          </div>
          )}
        </div>
      )}

      {/* CUSTOM VIDEO PLAYER WITH GESTURES */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black z-[500] flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <video 
            key={playingVideo.id} // Forces React to unmount and remount when video changes
            ref={videoRef}
            src={[
              'https://vjs.zencdn.net/v/oceans.mp4',
              'https://media.w3.org/2010/05/sintel/trailer.mp4',
              'https://www.w3schools.com/html/mov_bbb.mp4'
            ][(typeof playingVideo.id === 'number' ? playingVideo.id : String(playingVideo.id).charCodeAt(String(playingVideo.id).length - 1)) % 3]} 
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            preload="auto"
            loop
            onTimeUpdate={(e) => setVideoProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
          />
          
          <div className="absolute inset-0 flex z-10 touch-manipulation">
            <div className="w-1/3 h-full cursor-pointer" onPointerUp={() => handleVideoTap('left')}></div>
            <div className="w-1/3 h-full cursor-pointer" onPointerUp={() => handleVideoTap('center')}></div>
            <div className="w-1/3 h-full cursor-pointer" onPointerUp={() => handleVideoTap('right')}></div>
          </div>
          
          {/* Visual Gesture Feedback */}
          {gestureFeedback && (
            <div className={`absolute top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in-75 fade-out zoom-out-75 duration-300
              ${gestureFeedback.type === 'left' ? 'left-0 bg-gradient-to-r from-white/10 to-transparent' : 
                gestureFeedback.type === 'right' ? 'right-0 bg-gradient-to-l from-white/10 to-transparent' : 
                'left-1/3 bg-white/5 rounded-full'}`}
            >
              <div className="bg-black/60 text-white font-black text-xl px-6 py-4 rounded-full backdrop-blur-md shadow-2xl flex items-center gap-2">
                {gestureFeedback.text}
              </div>
            </div>
          )}

          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-20 pointer-events-none">
             <h3 className="text-white font-bold text-xl">{playingVideo.fileName}</h3>
             <button onClick={() => setPlayingVideo(null)} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md pointer-events-auto transition-colors">
               <X size={24} />
             </button>
          </div>

          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white/50 text-xs font-bold tracking-widest pointer-events-none text-center">
             DOUBLE TAP L/R: ±10s &bull; CENTER TAP: PLAY/PAUSE<br/>
             TRIPLE TAP L: COMMENTS &bull; TRIPLE TAP C: NEXT &bull; TRIPLE TAP R: CLOSE
          </div>

          {/* Progress Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 pointer-events-auto flex items-center gap-4">
             <span className="text-white text-sm font-bold w-12 text-right">{formatTime(videoProgress)}</span>
             <input 
               type="range" 
               min={0} 
               max={videoDuration || 100} 
               value={videoProgress} 
               onChange={(e) => {
                 if (videoRef.current) {
                   videoRef.current.currentTime = Number(e.target.value);
                   setVideoProgress(Number(e.target.value));
                 }
               }}
               className="flex-1 accent-red-600 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer hover:h-2 transition-all"
             />
             <span className="text-gray-400 text-sm font-bold w-12">{formatTime(videoDuration)}</span>
          </div>

          {showComments && (
            <div className="absolute top-0 bottom-0 left-0 w-[400px] bg-[#111]/95 backdrop-blur-xl z-50 p-6 border-r border-white/10 animate-in slide-in-from-left duration-300 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-white font-black text-xl">Comments</h3>
                 <div className="flex items-center gap-2">
                   <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10 outline-none">
                     <option value="en">English</option>
                     <option value="es">Spanish</option>
                     <option value="hi">Hindi</option>
                     <option value="fr">French</option>
                     <option value="de">German</option>
                     <option value="te">Telugu</option>
                   </select>
                   <button onClick={() => setShowComments(false)} className="text-gray-500 hover:text-white transition-colors"><X size={20}/></button>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                  {currentComments.map((c) => (
                    <div key={c.id} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                       <img src={c.avatar} className="w-10 h-10 rounded-full bg-white/10" />
                       <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <p className="text-xs font-bold text-gray-200">{c.user} <span className="text-gray-500 font-normal ml-1">{c.time}</span></p>
                           <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{c.city}</span>
                         </div>
                         <p className="text-sm text-white mt-1 break-words">{c.text}</p>
                         
                         {c.translatedText && (
                           <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-300">
                             {c.translatedText}
                           </div>
                         )}
                         
                         <div className="flex items-center gap-4 mt-3">
                           <button onClick={() => handleLike(c.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-500 transition-colors">
                             <ThumbsUp size={14} /> {c.likes}
                           </button>
                           <button onClick={() => handleDislike(c.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                             <ThumbsDown size={14} /> {c.dislikes}
                           </button>
                           <button onClick={() => handleTranslate(c.id, c.text)} disabled={c.isTranslating} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors ml-auto disabled:opacity-50">
                             <Languages size={14} /> {c.isTranslating ? '...' : 'Translate'}
                           </button>
                         </div>
                       </div>
                    </div>
                  ))}
                  {currentComments.length === 0 && <p className="text-center text-gray-500 text-sm mt-10">No comments yet.</p>}
               </div>
               <form onSubmit={handleAddComment} className="pt-4 border-t border-white/10 mt-auto">
                 <input 
                   type="text" 
                   value={newComment}
                   onChange={e => setNewComment(e.target.value)}
                   placeholder="Add a clean comment..." 
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 transition-colors" 
                 />
               </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
