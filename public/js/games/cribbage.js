import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';
import { TimerManager } from '../utils/timerManager.js';
import { handleEndGame } from '../utils/handleEndGame.js';

const ratio = 1.55;
const cardDims = {
	width: 0,
	height: 0,
};
const cardDelay = 400;
const cardOffset = 0.4;

const containerAll = document.querySelector('.container-all');
const playArea = document.querySelector('#play-area');
const myArea = document.querySelector('#my-area');
const myHand = myArea.querySelector('.hand-container');
const theirArea = document.querySelector('#opponent-area');
const theirHand = theirArea.querySelector('.hand-container');
const deckContainer = document.querySelector('.deck-container');

const createGameForm = document.querySelector('#create-game-form');
const radios = getElementArray(createGameForm, 'input[type="radio"]');
const timeAdj = createGameForm.querySelector('#adjustment');
const timeLabel = createGameForm.querySelector('#timer-setting');
const timeAdjLabel = document.querySelector('#adjustment-type');
const createGame = document.querySelector('#create-game');
const cancelButton = document.querySelector('#cancel-game');

const waitingBanner = document.querySelector('#waiting-banner');
const messageBanner = document.querySelector('#status-banner');

const gameDiv = document.querySelector('#game-div');
const navbar = document.querySelector('#navbar-game');
const gameList = document.querySelector('#game-list');
const lobbyChatContainer = document.querySelector('#chat-container');

const myTag = document.querySelector('#my-tag');
const myName = document.querySelector('#my-tag .player-name');
const myClock = document.querySelector('#my-tag .player-timer');
const myReserve = document.querySelector('#my-tag .player-reserve');
const theirTag = document.querySelector('#opponent-tag');
const theirName = document.querySelector('#opponent-tag .player-name');
const theirClock = document.querySelector('#opponent-tag .player-timer');
const theirReserve = document.querySelector('#opponent-tag .player-reserve');

const endGameModal = new bootstrap.Modal(
	document.querySelector('#end-game-modal')
);
const endGameBody = document.querySelector('#end-game-modal .modal-body');
const exitGame = document.querySelector('#exit-game');
const rematch = document.querySelector('#offer-rematch');
const rematchCount = document.querySelector('#rematch-count');

const drawDeck = document.querySelector('#draw-deck');

const newGameState = new StateHandler({
	game: 'cribbage',
	timer: true,
	time: 30,
	reserve: 5,
	target: 121,
});

const gameState = new StateHandler(null);

document.addEventListener('DOMContentLoaded', () => {
	const socket = io();

	const handleResizeCards = () => {
		const rect = deckContainer.getBoundingClientRect();
		if (
			cardDims.height === rect.height &&
			cardDims.width === rect.height / ratio
		)
			return;
		cardDims.height = rect.height;
		cardDims.width = rect.height / ratio;
		const cards = getElementArray(document, '.card-container');
		cards.forEach((c) => {
			c.style.width = `${cardDims.width}px`;
			c.style.height = `${cardDims.height}px`;
		});
	};
	window.addEventListener('resize', handleResizeCards);

	const getTimeString = (time) => {
		const sec = Math.floor((time % 60000) / 1000);
		const min = Math.floor(time / 60000);
		return `${min}:${sec < 10 ? '0' : ''}${sec}`;
	};

	const getSelected = (str) => {
		return (e) => {
			const type = (typeof e.detail[str]).toLowerCase();
			e.target.checked =
				e.detail[str] ===
				(type === 'string'
					? e.target.value
					: type === 'number'
					? Number(e.target.value)
					: type === 'boolean'
					? e.target.value.toLowerCase() === 'true'
					: e.target.value);
		};
	};
	radios.forEach((r) => {
		const name = r.getAttribute('name');
		newGameState.addWatcher(r, getSelected(name));
		r.addEventListener('change', (e) => {
			if (e.target.checked) {
				newGameState.setState((prev) => {
					const type = (typeof prev[name]).toLowerCase();
					prev[name] =
						type === 'string'
							? e.target.value
							: type === 'number'
							? Number(e.target.value)
							: type === 'boolean'
							? e.target.value.toLowerCase() === 'true'
							: e.target.value;
					return prev;
				});
			}
		});
	});

	const disableTimerFields = (e) => {
		e.target.disabled = e.detail.timer === 'off';
	};
	newGameState.addWatcher(timeAdj, disableTimerFields);
	newGameState.addWatcher(null, (state) => {
		time.value = state.time;
		if (state.timer) timeAdj.value = state.reserve;
	});

	newGameState.addWatcher(timeAdjLabel, (e) => {
		const a = e.target.parentElement.querySelector(
			'a[data-bs-toggle="tooltip"]'
		);

		if (a) {
			a.setAttribute(
				'data-bs-title',
				"Number of minutes in reserved time. If a player's move time expires, the reserve time will run. If the reserve time expires, the player forfeits the game. "
			);
			new bootstrap.Tooltip(a);
		}
	});
	const createNewGameTile = (data) => {
		const newTile = createElement('.game-tile');
		newTile.setAttribute('data-id', data.matchId);
		let joinBtn;

		joinBtn = createElement('button.btn.btn-primary.join-button');
		joinBtn.innerHTML = 'Join';

		const gameInfo = createElement('.game-info');

		gameInfo.innerHTML = `${data.host.name} (${data.host.rating})<br>`;
		gameInfo.innerHTML = gameInfo.innerHTML + `Game to ${data.target}<br>`;

		if (data.timer) {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.time}sec/move ${
					data.reserve > 0 ? `+ ${data.reserve}min reserve` : ''
				}`;
		} else {
			gameInfo.innerHTML = gameInfo.innerHTML + `Timer: Off`;
		}

		newTile.appendChild(gameInfo);
		newTile.appendChild(joinBtn);
		return newTile;
	};

	const lm = new LobbyManager(socket, createNewGameTile);

	const handleCreateGame = (e) => {
		const state = newGameState.getState();
		lm.createGame(state);
	};
	createGame.addEventListener('click', handleCreateGame);

	//game inputs, rules, etc.
	//if a game is in progress, show the board and not the navbar or the lobby area
	const disappearOnGame = (e) => {
		if (e.detail) e.target.classList.add('d-none');
		else e.target.classList.remove('d-none');
	};
	gameState.addWatcher(navbar, disappearOnGame);
	gameState.addWatcher(gameList, disappearOnGame);
	gameState.addWatcher(lobbyChatContainer, disappearOnGame);
	gameState.addWatcher(gameDiv, (e) => {
		if (e.detail) {
			if (e.target.classList.contains('d-none')) {
				e.target.classList.remove('d-none');
			}
		} else {
			e.target.classList.add('d-none');
		}
	});
	gameState.addWatcher(waitingBanner, (e) => {
		if (!e.detail || !e.detail.active) e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});

	gameState.addWatcher(messageBanner, (e) => {
		if (!e) return;
		if (!e.detail || !e.detail.active) return e.target.classList.add('d-none');
		else e.target.classList.remove('d-none');
		const content = e.target.querySelector('#status-content');
		if (!content) return;

		if (e.detail.status === 'ended') {
			content.innerHTML = 'Game over';
		} else if (e.detail.status === 'pregame')
			content.innerHTML = 'Game starting...';
		if (e.detail.stage === 'draw-for-crib')
			content.innerHTML = 'Drawing for first deal...';
		else if (e.detail.status === 'playing') {
			if (e.detail.stage === 'crib') {
				if (e.detail.crib === e.detail.myIndex)
					content.innerHTML = 'Select two cards for your crib.';
				else
					content.innerHTML = `Select two cards for ${
						e.detail.players[1 - e.detail.myIndex].user.name
					}'s crib.`;
			}
		} else if (e.detail.status === 'ended') {
			content.innerHTML = 'Game over';
		}
	});
	gameState.addWatcher(myName, (e) => {
		if (!e.detail) return;
		const ind = e.detail.myIndex;
		const p = e.detail.players[ind];
		if (!p.user) e.target.innerHTML = '???';
		else e.target.innerHTML = p.user.name;
	});
	gameState.addWatcher(theirName, (e) => {
		if (!e.detail) return;
		const ind = 1 - e.detail.myIndex;
		const p = e.detail.players[ind];
		if (!p.user) e.target.innerHTML = '???';
		else e.target.innerHTML = p.user.name;
	});

	const createCard = (card, flip, shown) => {
		const deck = document.querySelector('.deck-container');
		if (!deck) return null;
		const cont = createElement('.card-container');
		cont.style.height = `${cardDims.height}px`;
		cont.style.width = `${cardDims.width}px`;
		const pc = createElement('.playing-card');
		if (shown) pc.classList.add('shown');
		cont.appendChild(pc);
		let inner, front, back;
		//flippable - create the front and the back
		if (flip) {
			pc.classList.add('flip-card');
			inner = createElement('.flip-card-inner');
			front = createElement(`.flip-card-front`);
			if (card) {
				front.classList.add(`r-${card.rank}`, `s-${card.suit}`);
				cont.setAttribute('data-rank', card.rank);
				cont.setAttribute('data-suit', card.suit);
			}
			back = createElement('.flip-card-back');
			pc.appendChild(inner);
			inner.appendChild(front);
			inner.appendChild(back);
		}
		//not flippable - either show the card or the back
		else if (card) {
			pc.classList.add(`r-${card.rank}.s-${card.suit}`);
		} else {
			pc.classList.add('flipped');
		}
		return cont;
	};

	const removeAllCards = () => {
		[myHand, theirHand].forEach((h) => {
			h.innerHTML = '';
		});
	};

	const dealCards = (cards, flip, shown, hand) => {
		removeAllCards();
		const newCards = cards.map((c) => {
			const toReturn = createCard(c, flip, false);
			toReturn.classList.add('moving');
			playArea.appendChild(toReturn);
			return toReturn;
		});
		hand.style.width = `${
			cardDims.width + (cards.length - 1) * cardDims.width * cardOffset
		}px`;
		hand.style.height = `${cardDims.height}px`;

		const deckRect = deckContainer.getBoundingClientRect();
		const handRect = hand.getBoundingClientRect();

		newCards.forEach((c, i) => {
			setTimeout(() => {
				const dy = handRect.top - deckRect.top;
				const dx =
					handRect.left + i * cardOffset * cardDims.width - deckRect.left;
				c.style.transform = `translateX(${dx}px)`;
				c.style.transform += `translateY(${dy}px)`;
				if (shown) c.querySelector('.playing-card').classList.add('shown');
				setTimeout(() => {
					c.classList.remove('moving');
					hand.appendChild(c);
					c.style.transform = '';
				}, cardDelay);
			}, cardDelay * i);
		});

		return newCards;
	};

	const byRank = (a, b) => {
		return a.value - b.value;
	};
	//handler for rendering game state, etc.
	gameState.addWatcher(null, (state) => {
		if (!state?.status) return;
		handleResizeCards();
		if (state.status === 'pregame') {
			if (state.stage === 'draw-for-crib') {
				const hands = [
					state.players[state.myIndex].hand[0],
					state.players[1 - state.myIndex].hand[0],
				];
				dealCards(state.players[state.myIndex].hand, true, true, myHand);
				dealCards(state.players[1 - state.myIndex].hand, true, true, theirHand);

				setTimeout(() => {
					showMessage(
						'info',
						`${
							hands[0].value < hands[1].value
								? `You get`
								: state.players[1 - state.myIndex].user.name + ' gets'
						} the first deal.`,
						2000
					);
				}, cardDelay);
			}
		} else if (state.status === 'playing') {
			/**
			 * Playing stages:
			 * - crib
			 * - play
			 * - count-hand
			 * - count-crib
			 */
			if (state.stage === 'crib') {
				setTimeout(
					() => {
						const myCards = dealCards(
							state.players[state.myIndex].hand.sort(byRank),
							true,
							true,
							myHand,
							cardDelay
						);
						myCards.forEach((c) => {
							c.addEventListener('click', (e) => {
								const sc = getElementArray(myHand, '.selected-card');
								const cc = e.target.closest('.card-container');
								if (sc.length >= 2 && !cc.classList.contains('selected-card'))
									return;
								cc.classList.toggle('selected-card');
							});
						});
					},
					state.crib === state.myIndex ? cardDelay / 2 : 0
				);

				setTimeout(
					() => {
						dealCards(
							state.players[1 - state.myIndex].hand,
							true,
							false,
							theirHand,
							cardDelay
						);
					},
					state.crib === state.myIndex ? 0 : cardDelay / 2
				);
			}
		}
	});

	socket.on('update-game-state', (data) => {
		if (!data) return gameState.setState(null);
		if (data.players[0].reserve === 0) {
			myReserve.classList.add('d-none');
			theirReserve.classList.add('d-none');
		} else {
			myReserve.classList.remove('d-none');
			theirReserve.classList.remove('d-none');
		}

		if (data?.message) {
			showMessage(
				data.message.status,
				data.message.message,
				data.message.duration || 1000
			);
		}
		//cancel button exists when game is not yet active
		if (!data.active) {
			gameState.setState(data);
			cancelButton.setAttribute('data-id', data.matchId);
		}
		//game is active
		else {
			gameState.setState(data);
		}

		if (data.status === 'ended') {
			rematch.disabled = false;
			handleEndGame(endGameBody, data.html);
			endGameModal.show();
		} else {
			endGameModal.hide();
			rematch.disabled = true;
		}
	});
});
