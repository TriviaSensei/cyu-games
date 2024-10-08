import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';
import { TimerManager } from '../utils/timerManager.js';
import { handleEndGame } from '../utils/handleEndGame.js';

const createGameForm = document.querySelector('#create-game-form');
const radios = getElementArray(createGameForm, 'input[type="radio"]');
const timeAdj = createGameForm.querySelector('#adjustment');
const timeLabel = createGameForm.querySelector('#timer-setting');
const timeAdjLabel = document.querySelector('#adjustment-type');
const createGame = document.querySelector('#create-game');
const cancelButton = document.querySelector('#cancel-game');

const gameDiv = document.querySelector('#game-div');
const navbar = document.querySelector('#navbar-game');
const gameList = document.querySelector('#game-list');
const lobbyChatContainer = document.querySelector('#chat-container');

const waitingBanner = document.querySelector('#waiting-banner');
const messageBanner = document.querySelector('#status-banner');

const myTag = document.querySelector('#my-tag');
const myName = document.querySelector('#my-tag .player-name');
const myClock = document.querySelector('#my-tag .player-timer');
const myReserve = document.querySelector('#my-tag .player-reserve');
const theirTag = document.querySelector('#opponent-tag');
const theirName = document.querySelector('#opponent-tag .player-name');
const theirClock = document.querySelector('#opponent-tag .player-timer');
const theirReserve = document.querySelector('#opponent-tag .player-reserve');

const scoreContainer = document.querySelector('#score-container');
const button1 = document.querySelector('#score-1');
const button2 = document.querySelector('#score-2');

const endGameModal = new bootstrap.Modal(
	document.querySelector('#end-game-modal')
);
const endGameBody = document.querySelector('#end-game-modal .modal-body');
const exitGame = document.querySelector('#exit-game');
const rematch = document.querySelector('#offer-rematch');
const rematchCount = document.querySelector('#rematch-count');

const newGameState = new StateHandler({
	game: 'get10',
	go: 'random',
	timer: 'game',
	time: 1,
	increment: 30,
	reserve: 10,
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
			e.target.checked = e.detail[str] === e.target.value;
		};
	};
	radios.forEach((r) => {
		const name = r.getAttribute('name');
		newGameState.addWatcher(r, getSelected(name));
		r.addEventListener('change', (e) => {
			if (e.target.checked) {
				newGameState.setState((prev) => {
					prev[name] = e.target.value;
					return prev;
				});
			}
		});
	});

	const disableTimerFields = (e) => {
		e.target.disabled = e.detail.timer === 'off';
	};
	newGameState.addWatcher(time, disableTimerFields);
	newGameState.addWatcher(timeAdj, disableTimerFields);

	newGameState.addWatcher(timeLabel, (e) => {
		if (e.detail.timer === 'off') return;
		e.target.innerHTML = e.detail.timer;
	});

	newGameState.addWatcher(timeAdjLabel, (e) => {
		const a = e.target.parentElement.querySelector(
			'a[data-bs-toggle="tooltip"]'
		);
		if (e.detail.timer === 'game') {
			e.target.innerHTML = `Increment (sec)`;
			if (a)
				a.setAttribute(
					'data-bs-title',
					'Number of seconds to return to the timer after each turn'
				);
		} else if (e.detail.timer === 'move') {
			e.target.innerHTML = `Reserve (min)`;

			if (a)
				a.setAttribute(
					'data-bs-title',
					"Number of minutes in reserved time. If a player's move time expires, the reserve time will run. If the reserve time expires, the player forfeits the game. "
				);
		}
		if (a) new bootstrap.Tooltip(a);
	});

	newGameState.addWatcher(null, (state) => {
		time.value = state.time;
		if (state.timer === 'move') timeAdj.value = state.reserve;
		else if (state.timer === 'game') timeAdj.value = state.increment;
	});

	time.addEventListener('change', (e) => {
		const val = Number(e.target.value);
		const minVal = Number(e.target.getAttribute('min'));
		if (val < minVal)
			newGameState.setState((prev) => {
				return {
					...prev,
					time: minVal,
				};
			});
		else
			newGameState.setState((prev) => {
				return {
					...prev,
					time: val,
				};
			});
	});

	timeAdj.addEventListener('change', (e) => {
		const state = newGameState.getState();
		const attr = state.timer === 'game' ? 'increment' : 'reserve';
		const val = Number(e.target.value);
		const minVal = Number(e.target.getAttribute('min'));

		newGameState.setState((prev) => {
			prev[attr] = Math.max(minVal, val);
			return prev;
		});
	});

	const createNewGameTile = (data) => {
		const newTile = createElement('.game-tile');
		newTile.setAttribute('data-id', data.matchId);
		let joinBtn;

		joinBtn = createElement('button.btn.btn-primary.join-button');
		joinBtn.innerHTML = 'Join';

		const gameInfo = createElement('.game-info');

		gameInfo.innerHTML = `${data.host.name} (${data.host.rating}) ${
			data.go === 'random' ? '' : `(${data.go})`
		}<br>`;
		if (data.timer === 'game') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.time}min/game ${
					data.increment > 0 ? `+ ${data.increment}s/move` : ''
				}`;
		} else if (data.timer === 'move') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.time}min/move ${
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

	socket.on('update-game-state', (data) => {
		if (!data) return gameState.setState(null);
		if (data.players[0].timer !== 'move') {
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

	gameState.addWatcher(scoreContainer, (e) => {
		if (!e.detail) return;
		e.target.innerHTML = e.detail.points;
	});

	//clock and user tag manager
	let timerManager;
	gameState.addWatcher(null, (state) => {
		if (!state) return;
		const me = state.players[state.myIndex];
		const opp = state.players[1 - state.myIndex];
		if (me.user) {
			myName.innerHTML = me.user.name;
			myTag.setAttribute('data-id', me.user.id);
		}
		if (opp.user) {
			theirName.innerHTML = opp.user.name;
			theirTag.setAttribute('data-id', opp.user.id);
		}

		const startTime = state.players[0].time;
		const timeStr = getTimeString(startTime);
		myClock.innerHTML = timeStr;
		theirClock.innerHTML = timeStr;
		const startReserve = state.players[0].reserve;
		const reserveStr = getTimeString(startReserve);
		myReserve.innerHTML = reserveStr;
		theirReserve.innerHTML = reserveStr;

		if (
			state.players.every((p) => {
				return p.user !== null;
			})
		)
			if (!timerManager) {
				const mapper = (p) => {
					const id = p.user.id;
					return document.querySelector(`.player-tag[data-id="${id}"]`);
				};
				const getTurn = (state) => {
					if (!state.active || state.status !== 'playing') return -1;
					return state.turnsCompleted % 2;
				};

				timerManager = new TimerManager(
					mapper,
					getTurn,
					(player) => {
						return {
							time: player.time,
							reserve: player.reserve,
						};
					},
					state
				);
			}
	});

	gameState.addWatcher(null, (state) => {
		if (timerManager) timerManager.updateState(state);
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
		else if (e.detail.myIndex === e.detail.turnsCompleted % 2)
			content.innerHTML = 'Your turn';
		else
			content.innerHTML = `${
				e.detail.players[1 - e.detail.myIndex].user.name
			}'s turn`;
	});

	const handleButtonClick = (e) => {
		const value = Number(e.target.getAttribute('data-value'));

		socket.emit(
			'play-move',
			{ value },
			withTimeout((data) => {
				if (data.status !== 'OK') showMessage('error', data.message);
			}, timeoutMessage('Move timed out'))
		);
	};

	[button1, button2].forEach((b) => {
		b.addEventListener('click', handleButtonClick);
		gameState.addWatcher(b, (e) => {});
	});

	exitGame.addEventListener('click', () => {
		const state = gameState.getState();
		if (state.status !== 'ended')
			return showMessage('error', 'You may not exit the game this way.');
		socket.emit(
			'request-exit',
			null,
			withTimeout((data) => {
				if (data.status !== 'OK') return showMessage('error', data.message);
				gameState.setState(null);
			}, timeoutMessage('Request timed out.'))
		);
	});

	socket.on('user-exit', (data) => {
		showMessage('info', `${data.name} has left.`);
		rematch.disabled = true;
	});

	const getRematchCount = (players) => {
		return players.reduce((p, c) => {
			if (c.rematch) return p + 1;
			return p;
		}, 0);
	};
	rematch.addEventListener('click', () => {
		const state = gameState.getState();
		if (state.status !== 'ended')
			return showMessage('error', 'This game is still active.');

		socket.emit(
			'request-rematch',
			null,
			withTimeout((data) => {
				if (data.status !== 'OK') return showMessage('error', data.message);
				const rc = getRematchCount(data.players);
				rematchCount.innerHTML = `${rc}/${data.players.length}`;
				if (rc === data.players.length) {
					endGameModal.hide();
					rematchCount.innerHTML = '';
				}
			}, timeoutMessage('Request timed out.'))
		);
	});
	socket.on('rematch-request', (data) => {
		const rc = getRematchCount(data.players);
		rematchCount.innerHTML = `${rc}/${data.players.length}`;
		if (rc === data.players.length) {
			endGameModal.hide();
			rematchCount.innerHTML = '';
		}
	});
});
