// --- Get references to all HTML elements ---
const kanjiEl = document.getElementById('kanji-display');
const readingEl = document.getElementById('reading-display');
const englishEl = document.getElementById('english-display');
const buttonContainer = document.getElementById('button-container');
const progressTrackerEl = document.getElementById('progress-tracker');
const resetButton = document.getElementById('reset-progress');
const cardContainer = document.querySelector('.card-container');
const hardWordsButton = document.getElementById('hard-words-button');
const hardWordsModal = document.getElementById('hard-words-modal');
const closeModalButton = document.getElementById('close-modal-button');
const hardWordsListEl = document.getElementById('hard-words-list');
const clearHardWordsButton = document.getElementById('clear-hard-words-button');

// --- Global variables & Constants ---
let currentWord = {};
let quizState = 'initial';
let todaysSessionList = []; // The list of 200 words for today's session
let reviewedTodaySet = new Set(); // Tracks unique words reviewed today
const DAILY_GOAL = 200;
const MASTERY_LEVEL = 5;

// --- 1. Daily Session Logic ---
function startNewDay() {
    // Sort all words by their review level (lowest first) to prioritize hard words
    const sortedVocabulary = [...vocabulary].sort((a, b) => a.level - b.level);
    
    // Create the list for today by taking the first 200 words
    todaysSessionList = sortedVocabulary.slice(0, DAILY_GOAL);
    reviewedTodaySet.clear();

    // Save this new day's data to the browser's storage
    localStorage.setItem('sessionDate', new Date().toLocaleDateString());
    localStorage.setItem('todaysSessionList', JSON.stringify(todaysSessionList));
    localStorage.setItem('reviewedToday', JSON.stringify([])); // Reset reviewed list for the new day
}

function initializeSession() {
    const savedDate = localStorage.getItem('sessionDate');
    const today = new Date().toLocaleDateString();

    if (savedDate !== today) {
        startNewDay();
    } else {
        // Load today's session data from storage if it's the same day
        todaysSessionList = JSON.parse(localStorage.getItem('todaysSessionList') || '[]');
        const reviewedArray = JSON.parse(localStorage.getItem('reviewedToday') || '[]');
        reviewedTodaySet = new Set(reviewedArray);
        // If for some reason the list is empty, create a new one for today
        if(todaysSessionList.length === 0){
            startNewDay();
        }
    }
}


// --- 2. Progress and SRS Logic ---
function loadProgress() {
    const savedVocab = JSON.parse(localStorage.getItem('japaneseVocabProgress') || '{}');
    vocabulary.forEach(word => {
        word.level = savedVocab[word.japanese] || 0;
    });
}

function saveProgress() {
    const progressToSave = {};
    vocabulary.forEach(word => {
        progressToSave[word.japanese] = word.level;
    });
    localStorage.setItem('japaneseVocabProgress', JSON.stringify(progressToSave));
}

function updateProgressTracker() {
    const reviewedCount = reviewedTodaySet.size;
    progressTrackerEl.innerHTML = `<span>Today: <strong>${reviewedCount} / ${DAILY_GOAL}</strong></span>`;
}

resetButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to reset all progress AND start a new session for today?')) {
        localStorage.clear(); // Clear everything
        vocabulary.forEach(word => word.level = 0);
        startNewDay();
        displayNewWord();
    }
});

// --- 3. Word Selection Algorithm (Uses Daily List) ---
function getNextWord() {
    if (reviewedTodaySet.size >= DAILY_GOAL) {
        return null; // Goal met
    }

    let reviewPool = [];
    // Only use words from today's session list
    todaysSessionList.forEach(word => {
        const chances = Math.pow(2, 4 - Math.min(word.level, 4));
        for (let i = 0; i < chances; i++) {
            reviewPool.push(word);
        }
    });
    if (reviewPool.length === 0) return null;
    return reviewPool[Math.floor(Math.random() * reviewPool.length)];
}

// --- 4. UI and State Management ---
function displayNewWord() {
    cardContainer.classList.add('fading');
    setTimeout(() => {
        currentWord = getNextWord();

        if (!currentWord) {
            kanjiEl.textContent = '🎉';
            readingEl.textContent = "Goal Achieved!";
            englishEl.textContent = `You've reviewed ${DAILY_GOAL} words today. Great job!`;
            buttonContainer.innerHTML = '';
            cardContainer.classList.remove('fading');
            updateProgressTracker(); // Ensure tracker shows "200 / 200"
            return;
        }

        kanjiEl.textContent = currentWord.japanese;
        readingEl.textContent = currentWord.reading;
        englishEl.textContent = currentWord.english;
        readingEl.classList.remove('visible');
        englishEl.classList.remove('visible');
        buttonContainer.innerHTML = '<button id="reveal-button">Show Reading</button>';
        document.getElementById('reveal-button').addEventListener('click', handleButtonClick);
        quizState = 'initial';
        updateProgressTracker();
        cardContainer.classList.remove('fading');
    }, 300);
}

function handleButtonClick() {
    if (quizState === 'initial') {
        readingEl.classList.add('visible');
        document.getElementById('reveal-button').textContent = 'Show Meaning';
        quizState = 'reading_revealed';
    } else if (quizState === 'reading_revealed') {
        englishEl.classList.add('visible');
        buttonContainer.innerHTML = `
            <button id="hard-button">❌ Hard</button>
            <button id="easy-button">✅ Easy</button>`;
        document.getElementById('hard-button').addEventListener('click', () => rateWord(false));
        document.getElementById('easy-button').addEventListener('click', () => rateWord(true));
        quizState = 'english_revealed';
    }
}

function rateWord(wasEasy) {
    if (wasEasy) {
        currentWord.level++;
    } else {
        currentWord.level = 0;
        addHardWord(currentWord);
    }
    
    // Add the current word to the set of reviewed words for today
    if (!reviewedTodaySet.has(currentWord.japanese)) {
        reviewedTodaySet.add(currentWord.japanese);
        localStorage.setItem('reviewedToday', JSON.stringify(Array.from(reviewedTodaySet)));
    }
    
    saveProgress();
    displayNewWord();
}

// --- 5. Hard Words Modal Logic ---
function getHardWords() { return JSON.parse(localStorage.getItem('hardWordsList') || '[]'); }
function saveHardWords(words) { localStorage.setItem('hardWordsList', JSON.stringify(words)); }
function addHardWord(wordToAdd) {
    const hardWords = getHardWords();
    if (!hardWords.some(hw => hw.japanese === wordToAdd.japanese)) {
        hardWords.push(wordToAdd);
        saveHardWords(hardWords);
    }
}
function displayHardWords() {
    const hardWords = getHardWords();
    hardWordsListEl.innerHTML = '';
    if (hardWords.length === 0) {
        hardWordsListEl.innerHTML = '<li>Your hard words list is empty.</li>';
        return;
    }
    hardWords.forEach(word => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="kanji-item">${word.japanese}</span> (${word.reading})<br><small>${word.english}</small>`;
        hardWordsListEl.appendChild(listItem);
    });
}
hardWordsButton.addEventListener('click', () => {
    displayHardWords();
    hardWordsModal.classList.remove('hidden');
});
closeModalButton.addEventListener('click', () => {
    hardWordsModal.classList.add('hidden');
});
clearHardWordsButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire list of hard words?')) {
        saveHardWords([]);
        displayHardWords();
    }
});


// --- 6. Start the App ---
function initializeApp() {
    loadProgress();
    initializeSession();
    displayNewWord();
    document.getElementById('copyright-year').textContent = new Date().getFullYear();
}

initializeApp();