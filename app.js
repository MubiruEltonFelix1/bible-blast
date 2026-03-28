// ================ GLOBAL STATE ================
var QUESTION_TIME = 12; // seconds per question
var gameVolume = 0.7; // 70% default

const GameState = {
  pin: '',
  isHost: false,
  currentPlayer: null,
  questions: [],
  currentQuestion: 0,
  answered: false,
  timeRemaining: 12,
  pollInterval: null,
  category: 'All',
  difficulty: 'All',
  streak: 0
};

// ================ LOCALSTORAGE SYNC ================

function gameKey(pin) {
  return 'bb_game_' + pin;
}

function readSharedState(pin) {
  try {
    const raw = localStorage.getItem(gameKey(pin));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeSharedState(pin, state) {
  localStorage.setItem(gameKey(pin), JSON.stringify(state));
}

// ================ UTILITY FUNCTIONS ================

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });

  const targetScreen = document.getElementById(screenName);
  if (targetScreen) {
    targetScreen.classList.add('active');
    targetScreen.style.display = 'flex';
  }
}

function filterQuestions(category, difficulty) {
  let filtered = QUESTIONS.filter(function(q) {
    const catMatch = (category === 'All' || q.category === category);
    const diffMatch = (difficulty === 'All' || q.difficulty === difficulty);
    return catMatch && diffMatch;
  });

  if (!filtered || filtered.length < 3) {
    console.warn('filterQuestions: too few results, falling back to all questions');
    filtered = QUESTIONS.slice();
  }

  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = filtered[i];
    filtered[i] = filtered[j];
    filtered[j] = temp;
  }

  return filtered.slice(0, Math.min(10, filtered.length));
}

function calculateScore(timeRemainingSeconds) {
  var totalTime = QUESTION_TIME;
  return Math.max(100, Math.round(1000 - (totalTime - timeRemainingSeconds) * (900 / totalTime)));
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ================ SOUND & VOLUME ================

function playSound(frequency, duration, type = 'sine') {
  if (gameVolume <= 0) return;
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(gameVolume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.log('Audio not supported');
  }
}

function playCorrectSound() {
  // Two ascending beeps
  playSound(523, 0.1); // C5
  setTimeout(() => playSound(659, 0.15), 100); // E5
}

function playWrongSound() {
  // Descending beep
  playSound(400, 0.2);
}

function updateVolume(value) {
  gameVolume = value / 100;
  const label = document.getElementById('volume-label');
  if (label) label.textContent = value + '%';
  localStorage.setItem('bb_volume', gameVolume);
}

function initializeVolume() {
  const saved = localStorage.getItem('bb_volume');
  if (saved) {
    gameVolume = parseFloat(saved);
    const slider = document.getElementById('volume-slider');
    if (slider) {
      slider.value = gameVolume * 100;
      const label = document.getElementById('volume-label');
      if (label) label.textContent = Math.round(gameVolume * 100) + '%';
    }
  }
}

// Initialize volume on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeVolume);
} else {
  initializeVolume();
}

function updateTimerDisplay(seconds) {
  const fill = document.getElementById('timer-fill');
  const num = document.getElementById('timer-number');
  if (!fill || !num) return;

  const pct = (seconds / QUESTION_TIME) * 100;
  fill.style.width = pct + '%';
  num.textContent = seconds;

  const urgent = seconds <= Math.floor(QUESTION_TIME / 3);
  num.classList.toggle('urgent', urgent);
  fill.classList.toggle('urgent', urgent);
}

function updateStreakDisplay() {
  const badge = document.getElementById('streak-badge');
  const count = document.getElementById('streak-count');
  
  if (!badge || !count) return;
  
  if (GameState.streak > 0) {
    count.textContent = GameState.streak;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function renderQuestion(question) {
  document.getElementById('question-text').textContent = question.question;
  document.getElementById('ans-0').textContent = question.answers[0];
  document.getElementById('ans-1').textContent = question.answers[1];
  document.getElementById('ans-2').textContent = question.answers[2];
  document.getElementById('ans-3').textContent = question.answers[3];
  document.getElementById('q-category-badge').textContent = question.category;
  document.getElementById('q-difficulty-badge').textContent = question.difficulty;

  const shared = readSharedState(GameState.pin);
  const total = shared ? shared.questions.length : 10;
  document.getElementById('q-counter').textContent = 'Q ' + (GameState.currentQuestion + 1) + '/' + total;

  // Update streak display
  updateStreakDisplay();

  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach(b => {
    b.disabled = false;
    b.classList.remove('correct', 'wrong');
  });

  const fb = document.getElementById('feedback-strip');
  fb.className = 'feedback-strip';
  fb.style.display = 'none';

  GameState.answered = false;
  updateTimerDisplay(QUESTION_TIME);
}

function showAnswerFeedback(isCorrect, points, scripture) {
  const strip = document.getElementById('feedback-strip');
  const text = document.getElementById('feedback-text');
  const ref = document.getElementById('scripture-text');

  text.textContent = isCorrect ? '✓ Correct! +' + points + ' pts' : '✗ Wrong — no points this round';
  ref.textContent = scripture || '';
  strip.className = 'feedback-strip show ' + (isCorrect ? 'correct-fb' : 'wrong-fb');
  strip.style.display = 'block';
}

function showError(msg) {
  const el = document.getElementById('join-error');
  if (el) el.textContent = msg;
}

function spawnConfetti() {
  const colors = ['#c9a84c', '#e8c96a', '#3a7bd5', '#d64c2b', '#2e9e6b', '#f0e8d8'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (1.8 + Math.random() * 2) + 's';
      el.style.animationDelay = '0s';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 40);
  }
}

function renderLeaderboard(players) {
  const sorted = players.slice().sort((a, b) => b.score - a.score);

  const html = sorted
    .map((p, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
      const isMe = GameState.currentPlayer && p.name === GameState.currentPlayer.name;
      return (
        '<div class="lb-row ' +
        (isMe ? 'lb-me' : '') +
        '" style="animation-delay:' +
        (i * 0.08) +
        's">' +
        '<span class="lb-rank">' +
        medal +
        '</span>' +
        '<span class="lb-name">' +
        escapeHtml(p.name) +
        '</span>' +
        '<span class="lb-score">' +
        p.score +
        ' pts</span>' +
        '</div>'
      );
    })
    .join('');

  document.getElementById('leaderboard-list').innerHTML = html;
}

function renderFinalResults(players) {
  spawnConfetti();
  const sorted = players.slice().sort((a, b) => b.score - a.score);

  // Podium
  const podiumEl = document.getElementById('podium');
  const medals = ['🥇', '🥈', '🥉'];
  const order = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const barOrder = ['p2', 'p1', 'p3'];

  podiumEl.innerHTML = order
    .map((p, i) => {
      const realRank = sorted.indexOf(p);
      return (
        '<div class="podium-place">' +
        '<div class="podium-avatar">' +
        (medals[realRank] || '') +
        '</div>' +
        '<div class="podium-name">' +
        escapeHtml(p.name) +
        '</div>' +
        '<div class="podium-bar ' +
        barOrder[i] +
        '">' +
        (realRank + 1) +
        '</div>' +
        '<div class="podium-score">' +
        p.score +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  // Full leaderboard
  renderLeaderboard(sorted);
  document.getElementById('final-leaderboard').innerHTML = document.getElementById('leaderboard-list').innerHTML;
}

function refreshLobbyDisplay() {
  if (!GameState.isHost) return;
  const shared = readSharedState(GameState.pin);
  if (!shared) return;
  const list = document.getElementById('lobby-player-list');
  const count = document.getElementById('player-count');
  if (count) count.textContent = shared.players.length;
  if (list) {
    list.innerHTML = shared.players
      .map(p => '<div class="lb-row"><span>👤</span><span class="lb-name">' + escapeHtml(p.name) + '</span></div>')
      .join('');
  }
}

function resetPollTrackers() {
  _lastStatus = null;
  _lastQuestionIndex = -1;
}

// ================ HOST FUNCTIONS ================

function hostGeneratePin() {
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  GameState.pin = pin;
  GameState.isHost = true;
  GameState.category = document.getElementById('category-select').value || 'All';
  GameState.difficulty = document.getElementById('difficulty-select').value || 'All';

  const state = {
    pin: pin,
    status: 'lobby',
    questionIndex: 0,
    questionStartTime: null,
    questions: [],
    players: [],
    hostName: 'Host'
  };

  writeSharedState(pin, state);
  const pinDisplay = document.getElementById('pin-display');
  if (pinDisplay) pinDisplay.textContent = pin;
  showScreen('lobby-screen');

  resetPollTrackers();
  startPolling(pin);
}

function hostStartGame() {
  const shared = readSharedState(GameState.pin);
  if (!shared) {
    alert('Game session not found. Please generate a new PIN.');
    return;
  }

  const category = (document.getElementById('category-select') || {}).value || 'All';
  const difficulty = (document.getElementById('difficulty-select') || {}).value || 'All';

  let questions = filterQuestions(category, difficulty);

  if (!questions || questions.length === 0) {
    alert('No questions found for that filter. Using all questions.');
    questions = filterQuestions('All', 'All');
  }

  // Add host as a player if not already in
  const hostPlayerName = 'Host';
  const alreadyIn = shared.players.some(p => p.name === hostPlayerName);
  if (!alreadyIn) {
    shared.players.push({ name: hostPlayerName, score: 0, answers: [], lastUpdated: Date.now() });
    GameState.currentPlayer = { name: hostPlayerName };
  }

  shared.questions = questions;
  shared.status = 'question';
  shared.questionIndex = 0;
  shared.questionStartTime = Date.now();

  writeSharedState(GameState.pin, shared);

  GameState.questions = questions;
  GameState.currentQuestion = 0;
  GameState.answered = false;
  GameState.streak = 0;
  renderQuestion(questions[0]);
  showScreen('question-screen');
}

function hostNextQuestion() {
  advanceFromQuestion();
}

// ================ PLAYER FUNCTIONS ================

function joinGame() {
  const pin = document.getElementById('pin-input').value.trim();
  const name = document.getElementById('name-input').value.trim();

  if (!pin || !name) {
    showError('Enter both a PIN and your name.');
    return;
  }

  const shared = readSharedState(pin);

  if (!shared) {
    showError('Game not found. Check your PIN.');
    return;
  }
  if (shared.status === 'finished') {
    showError('This game has already ended.');
    return;
  }

  const nameTaken = shared.players.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (nameTaken) {
    showError('That name is already taken. Choose another.');
    return;
  }

  const newPlayer = { name: name, score: 0, answers: [], lastUpdated: Date.now() };
  shared.players.push(newPlayer);
  writeSharedState(pin, shared);

  GameState.pin = pin;
  GameState.currentPlayer = newPlayer;
  GameState.isHost = false;

  resetPollTrackers();
  startPolling(pin);

  if (shared.status === 'lobby') {
    showScreen('waiting-screen');
    document.getElementById('waiting-name-display').textContent = 'Hello, ' + name + '!';
  } else if (shared.status === 'question') {
    GameState.questions = shared.questions;
    GameState.currentQuestion = shared.questionIndex;
    GameState.answered = false;
    renderQuestion(shared.questions[shared.questionIndex]);
    showScreen('question-screen');
  }
}

function submitPlayerAnswer(pin, playerName, questionIndex, selectedIndex, correct, points) {
  const shared = readSharedState(pin);
  if (!shared) return;

  let player = shared.players.find(p => p.name === playerName);

  // If player not found, create entry (e.g., host playing)
  if (!player) {
    player = { name: playerName, score: 0, answers: [], lastUpdated: Date.now() };
    shared.players.push(player);
  }

  const alreadyAnswered = player.answers.some(a => a.questionIndex === questionIndex);
  if (alreadyAnswered) return;

  player.answers.push({
    questionIndex: questionIndex,
    selectedIndex: selectedIndex,
    correct: correct,
    points: correct ? points : 0,
    timeMs: shared.questionStartTime ? Date.now() - shared.questionStartTime : 0
  });

  player.score = player.answers.reduce((sum, a) => sum + a.points, 0);
  player.lastUpdated = Date.now();

  writeSharedState(pin, shared);
}

function selectAnswer(selectedIndex) {
  if (GameState.answered) return;
  GameState.answered = true;

  const question = GameState.questions[GameState.currentQuestion];
  const correctIndex = Number(question.correct);
  const isCorrect = selectedIndex === correctIndex;
  const points = isCorrect ? calculateScore(GameState.timeRemaining) : 0;

  // Handle streak
  if (isCorrect) {
    GameState.streak++;
    playCorrectSound();
  } else {
    GameState.streak = 0;
    playWrongSound();
  }
  
  updateStreakDisplay();

  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.remove('selected');
    if (i === correctIndex) btn.classList.add('correct');
    else if (i === selectedIndex && !isCorrect) btn.classList.add('wrong');
  });

  showAnswerFeedback(isCorrect, points, question.scripture);

  submitPlayerAnswer(GameState.pin, GameState.currentPlayer.name, GameState.currentQuestion, selectedIndex, isCorrect, points);

  // Auto-advance after feedback delay
  setTimeout(function() {
    if (GameState.isHost) {
      advanceFromQuestion();
    }
  }, 2500);
}

function timeUp() {
  if (GameState.answered) return;
  GameState.answered = true;

  const question = GameState.questions[GameState.currentQuestion];
  const correctIndex = Number(question.correct);
  
  // Reset streak on timeout
  GameState.streak = 0;
  updateStreakDisplay();
  playWrongSound();

  const buttons = document.querySelectorAll('.answer-btn');

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) btn.classList.add('correct');
  });

  showAnswerFeedback(false, 0, question.scripture);
  submitPlayerAnswer(
    GameState.pin,
    GameState.currentPlayer.name,
    GameState.currentQuestion,
    -1,
    false,
    0
  );

  // Auto-advance after feedback delay
  setTimeout(function() {
    if (GameState.isHost) {
      advanceFromQuestion();
    }
  }, 2500);
}

function advanceFromQuestion() {
  const shared = readSharedState(GameState.pin);
  if (!shared) return;

  const nextIndex = shared.questionIndex + 1;
  const isLastQuestion = nextIndex >= shared.questions.length;

  if (isLastQuestion) {
    // Last question answered — go straight to finished (results/leaderboard)
    shared.status = 'finished';
    writeSharedState(GameState.pin, shared);
  } else {
    // More questions — go straight to next question (skip leaderboard)
    shared.status = 'question';
    shared.questionIndex = nextIndex;
    shared.questionStartTime = Date.now();
    writeSharedState(GameState.pin, shared);
  }
}

// ================ POLLING LOOP ================

let _lastStatus = null;
let _lastQuestionIndex = -1;

function startPolling(pin) {
  if (GameState.pollInterval) clearInterval(GameState.pollInterval);

  GameState.pollInterval = setInterval(() => {
    const shared = readSharedState(pin);
    if (!shared) return;

    // Lobby: refresh player list for host
    if (shared.status === 'lobby') {
      refreshLobbyDisplay();
      return;
    }

    const statusChanged = shared.status !== _lastStatus;
    const questionChanged = shared.questionIndex !== _lastQuestionIndex;

    // Sync timer on question screen
    if (shared.status === 'question' && shared.questionStartTime) {
      const elapsed = Math.floor((Date.now() - shared.questionStartTime) / 1000);
      GameState.timeRemaining = Math.max(0, QUESTION_TIME - elapsed);
      updateTimerDisplay(GameState.timeRemaining);

      if (GameState.timeRemaining <= 0 && !GameState.answered) {
        timeUp();
      }
    }

    // React to status / question changes
    if (statusChanged || questionChanged) {
      _lastStatus = shared.status;
      _lastQuestionIndex = shared.questionIndex;

      if (shared.status === 'question') {
        GameState.questions = shared.questions;
        GameState.currentQuestion = shared.questionIndex;
        GameState.answered = false;
        renderQuestion(shared.questions[shared.questionIndex]);
        showScreen('question-screen');
        return;
      }

      if (shared.status === 'finished') {
        renderFinalResults(shared.players);
        showScreen('results-screen');
        return;
      }
    }
  }, 500);
}

// ================ GAME RESET ================

function resetGame() {
  if (GameState.pin) {
    localStorage.removeItem(gameKey(GameState.pin));
  }
  clearInterval(GameState.pollInterval);
  GameState.pin = '';
  GameState.isHost = false;
  GameState.currentPlayer = null;
  GameState.questions = [];
  GameState.currentQuestion = 0;
  GameState.answered = false;
  _lastStatus = null;
  _lastQuestionIndex = -1;
  showScreen('home-screen');
}

// ================ INIT ================

document.addEventListener('DOMContentLoaded', () => {
  showScreen('home-screen');
});
