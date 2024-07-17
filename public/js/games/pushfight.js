import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';

const createGameForm = document.querySelector('#create-game-form');
const radios = getElementArray(createGameForm, 'input[type="radio"]');

const gameMessage = document.querySelector('#game-message');
const waitingBanner = document.querySelector('#waiting-banner');
const messageBanner = document.querySelector('#message-banner');
const messageContent = document.querySelector('#message-content');
const cancelButton = document.querySelector('#cancel-game');
const time = createGameForm.querySelector('#time');
const timeAdj = createGameForm.querySelector('#adjustment');
const timeLabel = createGameForm.querySelector('#timer-setting');
const timeAdjLabel = document.querySelector('#adjustment-type');
const createGame = document.querySelector('#create-game');

const gameDiv = document.querySelector('#game-div');
const navbar = document.querySelector('#navbar-game');
const gameList = document.querySelector('#game-list');
const lobbyChatContainer = document.querySelector('#chat-container');

const statusBar = document.querySelector('#game-message');
const myTag = document.querySelector('#my-tag');
const myName = document.querySelector('#my-tag .player-name');
const myClock = document.querySelector('#my-tag .player-timer');
const myReserve = document.querySelector('#my-tag .player-reserve');
const theirTag = document.querySelector('#opponent-tag');
const theirName = document.querySelector('#opponent-tag .player-name');
const theirClock = document.querySelector('#opponent-tag .player-timer');
const theirReserve = document.querySelector('#opponent-tag .player-reserve');

const pieces = getElementArray(gameDiv, '.game-piece');

const newGameState = new StateHandler({
	game: 'pushfight',
	color: 'random',
	timer: 'game',
	time: 5,
	increment: 30,
	reserve: 10,
});

const gameState = new StateHandler(null);

const selectedPiece = new StateHandler(null);

document.addEventListener('DOMContentLoaded', () => {
	const socket = io();

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
			data.settings.color === 'random' ? '' : `(${data.settings.color})`
		}<br>`;
		if (data.settings.timer === 'game') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.settings.time}min/game ${
					data.settings.increment > 0
						? `+ ${data.settings.increment}s/move`
						: ''
				}`;
		} else if (data.settings.timer === 'move') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.settings.time}min/move ${
					data.settings.reserve > 0
						? `+ ${data.settings.reserve}min reserve`
						: ''
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
	const resizeBoard = () => {
		const gb = document.querySelector('#game-board');
		const gbc = document.querySelector('#game-board-container');
		const rect = gbc.getBoundingClientRect();
		for (var i = 20; i > 0; i--) {
			const pct = i * 5;
			gb.style = `width:${pct}%;`;
			const r2 = gb.getBoundingClientRect();
			if (r2.height <= rect.height - 50 && r2.width <= rect.width - 50) break;
		}
	};
	gameState.addWatcher(gameDiv, (e) => {
		if (e.detail) {
			if (e.target.classList.contains('d-none')) {
				e.target.classList.remove('d-none');
				resizeBoard();
			}
		} else {
			e.target.classList.add('d-none');
		}
	});
	window.addEventListener('resize', resizeBoard);

	const selectPiece = (e) => {
		const state = gameState.getState();
		if (e.target.classList.contains('white') && gameState.players[0].isMe) {
		}
	};
	pieces.forEach((p) => {
		p.addEventListener('click', selectPiece);
	});

	gameState.addWatcher(myName, (e) => {
		if (!e.detail) e.target.innerHTML = '????';
		else {
			const player = e.detail.players.find((p) => {
				return p.isMe;
			});
			if (player) e.target.innerHTML = player.user.name;
		}
	});
	gameState.addWatcher(theirName, (e) => {
		if (!e.detail) e.target.innerHTML = '????';
		else {
			const player = e.detail.players.find((p) => {
				if (!p) return false;
				return !p.isMe;
			});
			if (player && player.user) e.target.innerHTML = player.user.name;
		}
	});

	let clockState = [
		new StateHandler({
			interval: null,
			startingTimeLeft: 0,
			startingReserve: 0,
			startTime: null,
		}),
		new StateHandler({
			interval: null,
			startingTimeLeft: 0,
			startingReserve: 0,
			startTime: null,
		}),
	];

	const getTimeString = (time) => {
		const sec = Math.floor((time % 60000) / 1000);
		const min = Math.floor(time / 60000);
		return `${min}:${sec < 10 ? '0' : ''}${sec}`;
	};

	const updateClocks = (e) => {
		const state = e.detail;
		const clock = e.target.querySelector('.player-timer');
		const reserve = e.target.querySelector('.player-reserve');
		const timeElapsed =
			state.startTime && state.interval ? Date.now() - state.startTime : 0;
		const timeLeft = Math.max(0, state.startingTimeLeft - timeElapsed);
		clock.innerHTML = getTimeString(timeLeft);
		if (timeLeft === 0) {
			const reserveUsed = timeElapsed - state.startTime;
			const reserveLeft = Math.max(0, state.startingReserve - reserveUsed);
			reserve.innerHTML = getTimeString(reserveLeft);
		}
	};

	clockState[0].addWatcher(myTag, updateClocks);
	clockState[1].addWatcher(theirTag, updateClocks);

	//properly display the timers
	gameState.addWatcher(null, (state) => {
		console.log(state);
		if (!state) return;
		const me = state.players.find((p) => {
			return p.isMe;
		});
		const opponent = state.players.find((p) => {
			return !p.isMe;
		});

		if (!me) return;
		if (state.settings.timer === 'game') {
			myReserve.classList.add('d-none');
			theirReserve.classList.add('d-none');
		} else if (state.settings.timer === 'move') {
			myReserve.classList.remove('d-none');
			theirReserve.classList.remove('d-none');
		} else {
			myReserve.classList.add('d-none');
			theirReserve.classList.add('d-none');
			myClock.classList.add('d-none');
			theirClock.classList.add('d-none');
			myName.classList.add('active-timer');
			theirName.classList.add('active-timer');
		}

		//show the correct times, and clear the intervals

		let timeElapsedThisTurn = state.timeStamp - state.turnStart || 0;
		console.log(timeElapsedThisTurn);
		const myTurn =
			(state.players[0].isMe && state.turnsCompleted % 2 === 0) ||
			(state.players[1].isMe && state.turnsCompleted % 2 === 1);
		clockState[0].setState((prev) => {
			if (!myTurn)
				return {
					...prev,
					startingTimeLeft: me.time,
					startingReserve: me.reserve,
				};
			if (state.settings.timer === 'game')
				return {
					...prev,
					startingTimeLeft: me.time - timeElapsedThisTurn,
				};
			else if (state.settings.timer === 'move')
				return {
					...prev,
					startingTimeLeft: Math.max(0, me.time - timeElapsedThisTurn),
					startingReserve:
						me.time >= timeElapsedThisTurn
							? me.reserve
							: Math.max(0, me.reserve - (timeElapsedThisTurn - me.time)),
				};
		});
		clockState[1].setState((prev) => {
			if (myTurn)
				return {
					...prev,
					startingTimeLeft: opponent.time,
					startingReserve: opponent.reserve,
				};
			if (state.settings.timer === 'game')
				return {
					...prev,
					startingTimeLeft: opponent.time - timeElapsedThisTurn,
				};
			else if (state.settings.timer === 'move')
				return {
					...prev,
					startingTimeLeft: Math.max(0, opponent.time - timeElapsedThisTurn),
					startingReserve:
						opponent.time >= timeElapsedThisTurn
							? opponent.reserve
							: Math.max(
									0,
									opponent.reserve - (timeElapsedThisTurn - opponent.time)
							  ),
				};
		});
		console.log(clockState[0].getState());
		console.log(clockState[1].getState());

		//start the timers if necessary - time is kept (and periodically updated) server side
		// so this is only an approximation of the time left
		if (state.status !== 'playing' || state.settings.timer === 'off') return;
		//we are playing - whose turn is it?
		const myIndex = state.players[0].isMe ? 0 : 1;
		const turn = state.turnsCompleted % 2;
		//if it's my turn
		if (turn === myIndex) {
			//stop the opponent clock
			clockState[1].setState((prev) => {
				if (prev.interval) clearInterval(prev.interval);
				return {
					interval: null,
					startTime: null,
					startingTimeLeft: state.players[1 - myIndex].time,
					startingReserve: state.players[1 - myIndex].reserve,
				};
			});
			//start my clock
			clockState[0].setState((prev) => {
				return {
					interval: setInterval(() => {
						clockState[0].refreshState();
					}, 1000),
					startTime: Date.now(),
					startingTimeLeft: state.players[myIndex].time,
					startingReserve: state.players[myIndex].reserve,
				};
			});
		}
		//not my turn
		else {
			//stop my clock
			clockState[0].setState((prev) => {
				if (prev.interval) clearInterval(prev.interval);
				return {
					interval: null,
					startTime: null,
					startingTimeLeft: state.players[myIndex].time,
					startingReserve: state.players[myIndex].reserve,
				};
			});
			//start my opponent's clock
			clockState[1].setState((prev) => {
				if (prev.interval) clearInterval(prev.interval);
				return {
					interval: setInterval(() => {
						clockState[1].refreshState();
					}, 1000),
					startTime: Date.now(),
					startingTimeLeft: state.players[1 - myIndex].time,
					startingReserve: state.players[1 - myIndex].reserve,
				};
			});
		}
	});

	gameState.addWatcher(waitingBanner, (e) => {
		if (!e.detail) return;
		if (!e.detail.active) e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});

	gameState.addWatcher(messageBanner, (e) => {
		if (!e?.detail) return;
		if (e.detail.active) e.target.classList.remove('d-none');
		else e.target.classList.add('d-none');
	});

	/*
	Game states:
	- not started (active = false)
	- pregame (players full, 3 seconds)
	- piece placement (turns<=1)
	- white turn
		- 2 moves left
		- 1 move left
		- 0 moves left (must push)
	- black turn (same as above)
	- ended
	*/

	socket.on('update-game-state', (data) => {
		if (!data) return gameState.setState(null);

		if (data?.message)
			showMessage(
				data.message.status,
				data.message.message,
				data.message.duration || 1000
			);
		//cancel button exists when game is not yet active
		if (!data.active) {
			gameState.setState(data);
			cancelButton.setAttribute('data-id', data.matchId);
		}
		//game is active
		else {
			cancelButton.removeAttribute('data-id');
			//determine if we are white or black and switch the pieces if black
			//this only really matters on turn 0 and 1, when we are placing our pieces on the board for the first time.
			if (data.players[1].isMe) {
				//we're black, switch the colors of the pieces showing on either end of the board
				const pieces = getElementArray(gameDiv, '.game-piece');
				pieces.forEach((p) => {
					if (Number(p.getAttribute('data-id')) < 5) {
						p.classList.add('white');
						p.classList.remove('black');
					} else {
						p.classList.add('black');
						p.classList.remove('white');
					}
				});
			}

			gameState.setState(data);
		}
	});
});
