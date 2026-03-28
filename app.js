// Global Game State
const GameState = {
  mode: 'solo',
  players: [],
  currentQuestion: 0,
  questions: [],
  timer: null,
  timeRemaining: 20,
  pin: '',
  category: 'All',
  difficulty: 'All',
  quizTitle: 'Bible Battle Round 1',
  playerName: '',
  gameStarted: false
};

// AI Bot names
const BOT_NAMES = ['SolomonBot 🤖', 'EstherAI 💡', 'PaulScript ✝️'];

// ==================== UTILITY FUNCTIONS ====================

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function filterQuestions(category, difficulty) {
  let filtered = QUESTIONS;
  
  if (category !== 'All') {
    filtered = filtered.filter(q => q.category === category);
  }
  
  if (difficulty !== 'All') {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }
  
  // Shuffle array
  filtered = filtered.sort(() => Math.random() - 0.5);
  
  // Return first 10 or all available
  return filtered.slice(0, 10);
}

function calculateScore(timeRemaining) {
  return Math.max(100, 1000 - (20 - timeRemaining) * 40);
}

function showScreen(screenName) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show target screen
  const targetScreen = document.getElementById(screenName);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

// ==================== SCREEN MANAGEMENT ====================

function initHome() {
  showScreen('home-screen');
}

function initHostSetup() {
  showScreen('host-setup-screen');
  document.getElementById('quiz-title-input').value = GameState.quizTitle;
  document.getElementById('category-select').value = 'All';
  document.getElementById('difficulty-select').value = 'All';
}

function initPlayerJoin() {
  showScreen('player-join-screen');
  document.getElementById('pin-input').value = '';
  document.getElementById('player-name-input').value = '';
}

function initLobby() {
  GameState.pin = generatePIN();
  GameState.category = document.getElementById('category-select').value;
  GameState.difficulty = document.getElementById('difficulty-select').value;
  GameState.quizTitle = document.getElementById('quiz-title-input').value;
  
  showScreen('lobby-screen');
  document.getElementById('pin-display').textContent = GameState.pin;
  document.getElementById('quiz-title-display').textContent = GameState.quizTitle;
}

function startGame() {
  GameState.gameStarted = true;
  GameState.questions = filterQuestions(GameState.category, GameState.difficulty);
  GameState.currentQuestion = 0;
  
  // Initialize player (real player)
  GameState.players = [{
    name: GameState.playerName || 'You',
    score: 0,
    answers: []
  }];
  
  // Add AI bots
  BOT_NAMES.forEach(botName => {
    GameState.players.push({
      name: botName,
      score: 0,
      answers: []
    });
  });
  
  showQuestion(0);
}

function showQuestion(index) {
  if (index >= GameState.questions.length) {
    endGame();
    return;
  }
  
  GameState.currentQuestion = index;
  const question = GameState.questions[index];
  
  showScreen('question-screen');
  
  // Update question info
  document.getElementById('question-counter').textContent = `Question ${index + 1} of ${GameState.questions.length}`;
  document.getElementById('question-category').textContent = question.category;
  document.getElementById('question-difficulty').textContent = question.difficulty;
  document.getElementById('question-text').textContent = question.question;
  document.getElementById('scripture-ref').innerHTML = '';
  
  // Clear previous buttons
  const answersContainer = document.getElementById('answers-container');
  answersContainer.innerHTML = '';
  
  // Create answer buttons
  question.answers.forEach((answer, idx) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.setAttribute('data-answer-index', idx);
    btn.textContent = String.fromCharCode(65 + idx) + '. ' + answer;
    btn.addEventListener('click', () => selectAnswer(idx));
    answersContainer.appendChild(btn);
  });
  
  // Reset timer
  GameState.timeRemaining = 20;
  startTimer();
  
  // Animate progress bar
  const progressBar = document.getElementById('timer-bar');
  progressBar.style.width = '100%';
}

function startTimer() {
  // Clear existing timer
  if (GameState.timer) clearInterval(GameState.timer);
  
  const progressBar = document.getElementById('timer-bar');
  
  GameState.timer = setInterval(() => {
    GameState.timeRemaining--;
    
    // Update bar width
    const percentage = (GameState.timeRemaining / 20) * 100;
    progressBar.style.width = percentage + '%';
    
    // Update timer display
    document.getElementById('timer-text').textContent = GameState.timeRemaining + 's';
    
    if (GameState.timeRemaining <= 0) {
      clearInterval(GameState.timer);
      timeUp();
    }
  }, 1000);
}

function selectAnswer(answerIndex) {
  clearInterval(GameState.timer);
  
  const question = GameState.questions[GameState.currentQuestion];
  const buttons = document.querySelectorAll('.answer-btn');
  
  // Disable all buttons
  buttons.forEach(btn => btn.disabled = true);
  
  // Store answer
  GameState.players[0].answers.push(answerIndex);
  
  // Show feedback
  buttons.forEach((btn, idx) => {
    if (idx === question.correct) {
      btn.classList.add('correct');
    } else if (idx === answerIndex && answerIndex !== question.correct) {
      btn.classList.add('incorrect');
    }
  });
  
  // Show scripture
  document.getElementById('scripture-ref').textContent = question.scripture;
  
  // Calculate and award score
  const score = calculateScore(GameState.timeRemaining);
  GameState.players[0].score += score;
  
  // Show score popup
  const scorePopup = document.createElement('div');
  scorePopup.className = 'score-popup';
  scorePopup.textContent = '+' + score + ' pts';
  document.querySelector('.question-container').appendChild(scorePopup);
  
  // Simulate AI answers and scores
  BOT_NAMES.forEach((botName, idx) => {
    const botPlayer = GameState.players[idx + 1];
    botPlayer.answers.push(Math.floor(Math.random() * 4));
    botPlayer.score += Math.floor(200 + Math.random() * 700);
  });
  
  // Auto-advance after 2 seconds
  setTimeout(() => {
    nextQuestion();
  }, 2000);
}

function timeUp() {
  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach(btn => btn.disabled = true);
  
  const question = GameState.questions[GameState.currentQuestion];
  
  // Show correct answer
  buttons.forEach((btn, idx) => {
    if (idx === question.correct) {
      btn.classList.add('correct');
    }
  });
  
  // Show scripture
  document.getElementById('scripture-ref').textContent = question.scripture;
  
  // Simulate AI answers
  BOT_NAMES.forEach((botName, idx) => {
    const botPlayer = GameState.players[idx + 1];
    botPlayer.answers.push(Math.floor(Math.random() * 4));
    botPlayer.score += Math.floor(200 + Math.random() * 700);
  });
  
  // Auto-advance
  setTimeout(() => {
    nextQuestion();
  }, 2000);
}

function nextQuestion() {
  // Show leaderboard every 3 questions or at the end
  if ((GameState.currentQuestion + 1) % 3 === 0 || GameState.currentQuestion === GameState.questions.length - 1) {
    showLeaderboard();
  } else {
    showQuestion(GameState.currentQuestion + 1);
  }
}

function showLeaderboard() {
  showScreen('leaderboard-screen');
  
  // Sort players by score
  const sortedPlayers = [...GameState.players].sort((a, b) => b.score - a.score);
  
  // Render leaderboard
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  sortedPlayers.forEach((player, idx) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    row.style.animationDelay = (idx * 0.1) + 's';
    
    let medal = '';
    if (idx === 0) medal = '🥇';
    else if (idx === 1) medal = '🥈';
    else if (idx === 2) medal = '🥉';
    
    row.innerHTML = `
      <span class="medal">${medal}</span>
      <span class="rank">${idx + 1}.</span>
      <span class="player-name">${player.name}</span>
      <span class="player-score">${player.score} pts</span>
    `;
    
    leaderboardList.appendChild(row);
  });
  
  // Show next button or auto-advance
  const nextBtn = document.getElementById('next-question-btn');
  if (GameState.currentQuestion === GameState.questions.length - 1) {
    nextBtn.textContent = 'See Results';
  } else {
    nextBtn.textContent = 'Next Question';
  }
}

function endGame() {
  // Sort players by final score
  const sortedPlayers = [...GameState.players].sort((a, b) => b.score - a.score);
  
  showScreen('results-screen');
  
  // Podium display
  const podium = document.getElementById('podium');
  podium.innerHTML = '';
  
  if (sortedPlayers[0]) {
    const first = document.createElement('div');
    first.className = 'podium-position first';
    first.innerHTML = `
      <div class="medal">🥇</div>
      <div class="name">${sortedPlayers[0].name}</div>
      <div class="score">${sortedPlayers[0].score} pts</div>
    `;
    podium.appendChild(first);
  }
  
  if (sortedPlayers[1]) {
    const second = document.createElement('div');
    second.className = 'podium-position second';
    second.innerHTML = `
      <div class="medal">🥈</div>
      <div class="name">${sortedPlayers[1].name}</div>
      <div class="score">${sortedPlayers[1].score} pts</div>
    `;
    podium.appendChild(second);
  }
  
  if (sortedPlayers[2]) {
    const third = document.createElement('div');
    third.className = 'podium-position third';
    third.innerHTML = `
      <div class="medal">🥉</div>
      <div class="name">${sortedPlayers[2].name}</div>
      <div class="score">${sortedPlayers[2].score} pts</div>
    `;
    podium.appendChild(third);
  }
  
  // Full leaderboard
  const fullLeaderboard = document.getElementById('full-leaderboard');
  fullLeaderboard.innerHTML = '';
  
  sortedPlayers.forEach((player, idx) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    row.style.animationDelay = (idx * 0.08) + 's';
    
    let medal = '';
    if (idx === 0) medal = '🥇';
    else if (idx === 1) medal = '🥈';
    else if (idx === 2) medal = '🥉';
    
    row.innerHTML = `
      <span class="medal">${medal}</span>
      <span class="rank">${idx + 1}.</span>
      <span class="player-name">${player.name}</span>
      <span class="player-score">${player.score} pts</span>
    `;
    
    fullLeaderboard.appendChild(row);
  });
  
  // Trigger confetti
  triggerConfetti();
}

function triggerConfetti() {
  const confettiContainer = document.getElementById('confetti');
  confettiContainer.innerHTML = '';
  
  for (let i = 0; i < 50; i++) {
    const confetto = document.createElement('div');
    confetto.className = 'confetto';
    confetto.style.left = Math.random() * 100 + '%';
    confetto.style.delay = Math.random() * 0.5 + 's';
    confetto.style.backgroundColor = ['#f5c518', '#e84393', '#00e676', '#ff1744', '#1e88e5'][Math.floor(Math.random() * 5)];
    confettiContainer.appendChild(confetto);
  }
}

function resetGame() {
  GameState.mode = 'solo';
  GameState.players = [];
  GameState.currentQuestion = 0;
  GameState.questions = [];
  GameState.timeRemaining = 20;
  GameState.pin = '';
  GameState.category = 'All';
  GameState.difficulty = 'All';
  GameState.quizTitle = 'Bible Battle Round 1';
  GameState.playerName = '';
  GameState.gameStarted = false;
  
  if (GameState.timer) clearInterval(GameState.timer);
  
  initHome();
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Home screen
  document.getElementById('host-btn').addEventListener('click', initHostSetup);
  document.getElementById('join-btn').addEventListener('click', initPlayerJoin);
  
  // Host setup
  document.getElementById('start-lobby-btn').addEventListener('click', initLobby);
  
  // Lobby
  document.getElementById('start-game-btn').addEventListener('click', () => {
    GameState.playerName = 'You (Host)';
    startGame();
  });
  
  // Player join
  document.getElementById('join-game-btn').addEventListener('click', () => {
    const pin = document.getElementById('pin-input').value.trim();
    const name = document.getElementById('player-name-input').value.trim();
    
    if (!pin || !name) {
      alert('Please enter PIN and name!');
      return;
    }
    
    GameState.pin = pin;
    GameState.playerName = name;
    
    // In a real game, this would validate the PIN on a server
    // For now, just simulate joining
    localStorage.setItem('playerName', name);
    
    showScreen('waiting-screen');
  });
  
  // Leaderboard next button
  document.getElementById('next-question-btn').addEventListener('click', () => {
    if (GameState.currentQuestion === GameState.questions.length - 1) {
      endGame();
    } else {
      showQuestion(GameState.currentQuestion + 1);
    }
  });
  
  // Results play again
  document.getElementById('play-again-btn').addEventListener('click', resetGame);
  
  // Initialize with home screen
  initHome();
});
