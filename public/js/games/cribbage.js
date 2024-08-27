import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';
import { TimerManager } from '../utils/timerManager.js';
import { handleEndGame } from '../utils/handleEndGame.js';

const containerAll = document.querySelector('.container-all');
const playArea = document.querySelector('#play-area');
const myArea = document.querySelector('#my-area');
const theirArea = document.querySelector('#opponent-area');

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

	const createCard = (card, flip, showing) => {
		const deck = document.querySelector('.deck-container');
		if (!deck) return null;
		const rect = deck.getBoundingClientRect();
		const cont = createElement('.card-container.ratio');
		cont.setAttribute('style', '--bs-aspect-ratio:155%;');
		cont.style.height = `${rect.height}px`;
		cont.style.width = `${rect.width}px`;
		const pc = createElement('.playing-card');
		cont.appendChild(pc);
		let inner, front, back;
		//flippable - create the front and the back
		if (flip) {
			pc.classList.add('flip-card');
			inner = createElement('.flip-card-inner');
			front = createElement(`.flip-card-front`);
			if (card) front.classList.add(`r-${card.rank}.s-${card.suit}`);
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

	//handler for rendering game state, etc.
	gameState.addWatcher(null, (state) => {
		if (!state?.status) return;
		if (state.status === 'pregame') {
			let c1 = document.querySelector('#my-card');
			if (!c1) {
				c1 = createCard(null, true, false);
				c1.setAttribute('id', 'my-card');
				c1.classList.add('moving');
				playArea.appendChild(c1);
			}
			let c2 = document.querySelector('#their-card');
			if (!c2) {
				c2 = createCard(null, true, false);
				c2.setAttribute('id', 'their-card');
				c2.classList.add('moving');
				playArea.appendChild(c2);
			}

			if (state.stage === 'draw-for-crib') {
				const hands = [
					state.players[state.myIndex].hand[0],
					state.players[1 - state.myIndex].hand[0],
				];

				const myRect = myArea.getBoundingClientRect();
				const playRect = playArea.getBoundingClientRect();
				const cr = c1.getBoundingClientRect();
				[c1, c2].forEach((c, i) => {
					const cd = c.querySelector('.playing-card');
					cd.classList.add('shown');
					const ci = c.querySelector('.flip-card-front');
					ci.classList.add(`r-${hands[i].rank}`, `s-${hands[i].suit}`);
					const dx = myRect.width / 2 - cr.width / 2;
					const r = i === 0 ? myArea : theirArea;
					const rect = r.getBoundingClientRect();
					const dy =
						(rect.bottom + rect.top) / 2 - (playRect.bottom + playRect.top) / 2;
					c.style.transform = `translateX(${dx}px)`;
					c.style.transform += `translateY(${dy}px)`;
				});

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
				}, 400);
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
