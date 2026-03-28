// ================ GLOBAL STATE ================
const GameState = {
  pin: '',
  isHost: false,
  currentPlayer: null,
  questions: [],
  currentQuestion: 0,
  answered: false,
  timeRemaining: 20,
  pollInterval: null,
  category: 'All',
  difficulty: 'All'
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
  let filtered = QUESTIONS;

  if (category !== 'All') {
    filtered = filtered.filter(q => q.category === category);
  }

  if (difficulty !== 'All') {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }

  if (filtered.length < 5) {
    filtered = QUESTIONS.slice();
  }

  filtered.sort(() => Math.random() - 0.5);
  return filtered.slice(0, 10);
}

function calculateScore(timeRemainingSeconds) {
  return Math.max(100, 1000 - (20 - timeRemainingSeconds) * 40);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateTimerDisplay(seconds) {
  const fill = document.getElementById('timer-fill');
  const num = document.getElementById('timer-number');
  if (!fill || !num) return;

  const pct = (seconds / 20) * 100;
  fill.style.width = pct + '%';
  num.textContent = seconds;

  const urgent = seconds <= 5;
  num.classList.toggle('urgent', urgent);
  fill.classList.toggle('urgent', urgent);
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

  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach(b => {
    b.disabled = false;
    b.classList.remove('correct', 'wrong');
  });

  const fb = document.getElementById('feedback-strip');
  fb.className = 'feedback-strip';
  fb.style.display = 'none';

  GameState.answered = false;
  updateTimerDisplay(20);
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

// ================ HOST FUNCTIONS ================

function hostGeneratePin() {
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  GameState.pin = pin;
  GameState.isHost = true;
  GameState.category = document.getElementById('category-select').value;
  GameState.difficulty = document.getElementById('difficulty-select').value;

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
  showScreen('lobby-screen');
  document.getElementById('pin-display').textContent = pin;

  startPolling(pin);
}

function hostStartGame() {
  const shared = readSharedState(GameState.pin);
  if (!shared) return;

  const questions = filterQuestions(GameState.category, GameState.difficulty);
  shared.questions = questions;
  shared.status = 'question';
  shared.questionIndex = 0;
  shared.questionStartTime = Date.now();

  writeSharedState(GameState.pin, shared);
}

function hostNextQuestion() {
  const shared = readSharedState(GameState.pin);
  if (!shared) return;

  const nextIndex = shared.questionIndex + 1;

  if (nextIndex >= shared.questions.length) {
    shared.status = 'finished';
  } else {
    shared.status = 'question';
    shared.questionIndex = nextIndex;
    shared.questionStartTime = Date.now();
  }

  writeSharedState(GameState.pin, shared);
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

  const player = shared.players.find(p => p.name === playerName);
  if (!player) return;

  const alreadyAnswered = player.answers.some(a => a.questionIndex === questionIndex);
  if (alreadyAnswered) return;

  player.answers.push({
    questionIndex: questionIndex,
    selectedIndex: selectedIndex,
    correct: correct,
    points: correct ? points : 0,
    timeMs: Date.now() - shared.questionStartTime
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

  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.remove('selected');
    if (i === correctIndex) btn.classList.add('correct');
    else if (i === selectedIndex && !isCorrect) btn.classList.add('wrong');
  });

  showAnswerFeedback(isCorrect, points, question.scripture);

  submitPlayerAnswer(GameState.pin, GameState.currentPlayer.name, GameState.currentQuestion, selectedIndex, isCorrect, points);
}

// ================ POLLING LOOP ================

let _lastStatus = null;
let _lastQuestionIndex = -1;

function startPolling(pin) {
  if (GameState.pollInterval) clearInterval(GameState.pollInterval);

  GameState.pollInterval = setInterval(() => {
    const shared = readSharedState(pin);
    if (!shared) return;

    const statusChanged = shared.status !== _lastStatus;
    const questionChanged = shared.questionIndex !== _lastQuestionIndex;

    _lastStatus = shared.status;
    _lastQuestionIndex = shared.questionIndex;

    // Update timer from shared clock
    if (shared.status === 'question' && shared.questionStartTime) {
      const elapsed = Math.floor((Date.now() - shared.questionStartTime) / 1000);
      GameState.timeRemaining = Math.max(0, 20 - elapsed);
      updateTimerDisplay(GameState.timeRemaining);

      if (GameState.timeRemaining === 0 && !GameState.answered) {
        GameState.answered = true;
        const question = GameState.questions[GameState.currentQuestion];
        const correctIndex = Number(question.correct);
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach((btn, i) => {
          btn.disabled = true;
          if (i === correctIndex) btn.classList.add('correct');
        });

        showAnswerFeedback(false, 0, question.scripture);
        submitPlayerAnswer(GameState.pin, GameState.currentPlayer.name, GameState.currentQuestion, -1, false, 0);
      }
    }

    // React to state transitions
    if (statusChanged || questionChanged) {
      if (shared.status === 'question' && questionChanged) {
        GameState.questions = shared.questions;
        GameState.currentQuestion = shared.questionIndex;
        GameState.answered = false;
        renderQuestion(shared.questions[shared.questionIndex]);
        showScreen('question-screen');
      }
      if (shared.status === 'leaderboard') {
        renderLeaderboard(shared.players);
        const nqBtn = document.getElementById('next-q-btn');
        if (nqBtn) nqBtn.style.display = GameState.isHost ? 'block' : 'none';
        showScreen('leaderboard-screen');
      }
      if (shared.status === 'finished') {
        renderFinalResults(shared.players);
        showScreen('results-screen');
      }
    }

    // Update lobby player display
    if (GameState.isHost && shared.status === 'lobby') {
      refreshLobbyDisplay();
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
