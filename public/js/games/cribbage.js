import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import {
	withTimeout,
	timeoutMessage,
	defaultCallback,
} from '../utils/socketTimeout.js';
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
const cardDelay = 300;
const cardOffset = 0.4;

const containerAll = document.querySelector('.container-all');
const playArea = document.querySelector('#play-area');
const playedCards = playArea.querySelector('.play-container');
const myArea = document.querySelector('#my-area');
const myHand = myArea.querySelector('.hand-container');
const theirArea = document.querySelector('#opponent-area');
const theirHand = theirArea.querySelector('.hand-container');
const deckContainer = document.querySelector('.deck-container');
const gamePrompt = document.querySelector('#game-prompt');
const pegCount = document.querySelector('.peg-count');
const myMessage = document.querySelector('#my-message');
const theirMessage = document.querySelector('#opponent-message');

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
const myScore = myTag.querySelector('.score-container');
const theirTag = document.querySelector('#opponent-tag');
const theirName = document.querySelector('#opponent-tag .player-name');
const theirClock = document.querySelector('#opponent-tag .player-timer');
const theirReserve = document.querySelector('#opponent-tag .player-reserve');
const theirScore = theirTag.querySelector('.score-container');

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

		if (e.detail.status === 'ended') content.innerHTML = 'Game over';
		else if (e.detail.status === 'pregame')
			content.innerHTML = 'Game starting...';
		else if (e.detail.status === 'playing') {
			content.innerHTML = 'Game in progress';
			if (e.detail.stage === 'play') {
				if (e.detail.turn === e.detail.myIndex) content.innerHTML = `Your turn`;
				else
					content.innerHTML = `${
						e.detail.players[1 - e.detail.myIndex].user.name
					}'s turn`;
			}
		}
	});

	gameState.addWatcher(gamePrompt, (e) => {
		if (!e) return;
		if (!e.detail?.stage) {
			e.target.classList.add('d-none');
			return;
		}

		if (e.detail.stage === 'crib') {
			if (e.detail.dealer === e.detail.myIndex)
				e.target.innerHTML = '<div>Select two cards for your crib.<div>';
			else
				e.target.innerHTML = `<div>Select two cards for ${
					e.detail.players[1 - e.detail.myIndex].user.name
				}'s crib.</div>`;

			const btn = createElement('button.btn.btn-primary.confirm-crib');
			btn.addEventListener('click', confirmCrib);
			btn.innerHTML = 'Confirm';
			e.target.appendChild(btn);
			e.target.classList.remove('d-none');
		} else if (e.detail.stage === 'play') {
			if (e.detail.playedCards.length === 0) {
				if (e.detail.turn === e.detail.myIndex)
					e.target.innerHTML = `Your turn`;
				else
					e.target.innerHTML = `${
						e.detail.players[1 - e.detail.myIndex].user.name
					}'s turn`;

				e.target.classList.remove('d-none');
			} else {
				e.target.classList.add('d-none');
			}
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

	gameState.addWatcher(pegCount, (e) => {
		if (e.detail?.stage !== 'play') {
			e.target.classList.add('d-none');
			return;
		}
		e.target.classList.remove('d-none');

		const lastMove =
			e.detail.playedCards.length > 0
				? e.detail.playedCards.slice(-1).pop()
				: null;

		const ct = e.target.querySelector('#count');
		if (!lastMove?.count) ct.innerHTML = '0';
		else ct.innerHTML = lastMove.count;
	});

	let messageTimeouts = [null, null];

	//showing message for scoring during play
	gameState.addWatcher(null, (state) => {
		if (!state?.playedCards) return;
		const scoring = state?.scoring;
		const lastPlay =
			state.playedCards.length === 0 ? null : state.playedCards.slice(-1).pop();

		let msg;
		const player = lastPlay?.player || state.dealer;

		myMessage.classList.add('d-none');
		theirMessage.classList.add('d-none');
		if (scoring && scoring.length > 0) {
			const str = scoring.join(', ');

			if (!lastPlay) {
				msg = player === state.myIndex ? myMessage : theirMessage;
			} else {
				msg = lastPlay.player === state.myIndex ? myMessage : theirMessage;
			}

			if (messageTimeouts[player]) {
				clearTimeout(messageTimeouts[player]);
			}
			msg.innerHTML = str;
			msg.classList.remove('d-none');
		} else if (lastPlay && !lastPlay.card) {
			msg = player === state.myIndex ? myMessage : theirMessage;
			msg.innerHTML = 'Go';
			msg.classList.remove('d-none');
		}
	});

	//scores
	gameState.addWatcher(myScore, (e) => {
		if (!e.detail) return;
		const ind = e.detail.myIndex;
		e.target.innerHTML = e.detail.players[ind].score;
	});
	gameState.addWatcher(theirScore, (e) => {
		if (!e.detail) return;
		const ind = e.detail.myIndex;
		e.target.innerHTML = e.detail.players[1 - ind].score;
	});

	const confirmCrib = (e) => {
		const selectedCards = getElementArray(myArea, '.selected-card');
		if (selectedCards.length !== 2)
			return showMessage('error', 'You must select select 2 cards');
		socket.emit(
			'play-move',
			{
				cards: selectedCards.map((c) => {
					return {
						suit: c.getAttribute('data-suit'),
						rank: c.getAttribute('data-rank'),
					};
				}),
			},
			withTimeout((data) => {
				if (data.status !== 'OK') return showMessage('error', data.message);
				selectedCards.forEach((c) => {
					c.remove();
				});
				e.target.remove();
				if (data.gameState.crib.length !== 4)
					gamePrompt.innerHTML = 'Waiting for opponent...';
			}, timeoutMessage)
		);
	};

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
			pc.classList.add(`r-${card.rank}`, `s-${card.suit}`);
		} else {
			pc.classList.add('flipped');
		}
		return cont;
	};

	const removeAllCards = (hand) => {
		hand.innerHTML = '';
	};

	const dealCards = (cards, flip, shown, hand, delay) => {
		removeAllCards(hand);
		const state = gameState.getState();
		const newCards = cards.map((c) => {
			const toReturn = createCard(c, flip, false);
			toReturn.classList.add('moving');
			playArea.appendChild(toReturn);
			return toReturn;
		});
		hand.style.width = `${
			cardDims.width +
			(state.stage === 'draw-for-crib' ? 0 : 5) * cardDims.width * cardOffset
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
			}, delay * i);
		});

		return newCards;
	};

	const displayCards = (cards, flip, shown, hand) => {
		removeAllCards(hand);
		const state = gameState.getState();
		const newCards = cards.map((c) => {
			const toReturn = createCard(c, flip, shown);
			playArea.appendChild(toReturn);
			return toReturn;
		});
		hand.style.width = `${
			cardDims.width +
			(state.stage === 'crib' ? 0 : 5) * cardDims.width * cardOffset
		}px`;
		hand.style.height = `${cardDims.height}px`;

		newCards.forEach((c) => hand.appendChild(c));
		return newCards;
	};

	const byRank = (a, b) => {
		return a.value - b.value;
	};

	const selectCard = (e) => {
		const state = gameState.getState();

		const sc = getElementArray(myHand, '.selected-card');
		const cc = e.target.closest('.card-container');

		if (state.stage === 'crib') {
			if (sc.length >= 2 && !cc.classList.contains('selected-card')) return;
			cc.classList.toggle('selected-card');
		} else if (state.stage === 'play') {
			if (cc.classList.contains('selected-card')) {
				//if the card is "selected" and then clicked, attempt to play it
				const data = {
					suit: cc.getAttribute('data-suit'),
					rank: cc.getAttribute('data-rank'),
				};
				socket.emit(
					'play-move',
					data,
					withTimeout((data) => {
						if (data.status !== 'OK') return showMessage('error', data.message);
						gameState.setState(data.gameState);
					})
				);
			} else {
				cc.classList.toggle('selected-card');
				sc.forEach((c) => {
					c.classList.remove('selected-card');
				});
			}
		}
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
				dealCards(
					state.players[state.myIndex].hand,
					true,
					true,
					myHand,
					cardDelay
				);
				dealCards(
					state.players[1 - state.myIndex].hand,
					true,
					true,
					theirHand,
					cardDelay
				);

				setTimeout(() => {
					showMessage(
						'info',
						`${
							hands[0].value < hands[1].value
								? `You get`
								: state.players[1 - state.myIndex].user.name + ' gets'
						} the first deal.`,
						1500
					);
				}, cardDelay);
			}
		} else if (state.status === 'playing') {
			//indicator for whose crib it is
			let cribIndicator = document.querySelector('.crib-indicator');
			if (!cribIndicator) cribIndicator = createElement('.crib-indicator');

			if (state.dealer === state.myIndex) myTag.appendChild(cribIndicator);
			else theirTag.appendChild(cribIndicator);

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
							c.addEventListener('click', selectCard);
						});
					},
					state.dealer === state.myIndex ? cardDelay / 2 : 0
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
					state.dealer === state.myIndex ? 0 : cardDelay / 2
				);
			} else if (state.stage === 'play') {
				const cc = deckContainer.querySelector('.card-container');
				const pc = cc.querySelector('.playing-card');
				const cf = cc.querySelector('.flip-card-front');
				cf.classList.add(
					`r-${state.turnCard.rank}`,
					`s-${state.turnCard.suit}`
				);
				pc.classList.add('shown');

				const myCards = displayCards(
					state.players[state.myIndex].hand.sort(byRank),
					true,
					true,
					myHand
				);
				myCards.forEach((c) => {
					c.addEventListener('click', selectCard);
				});
				displayCards(
					state.players[1 - state.myIndex].hand,
					true,
					false,
					theirHand
				);
			} else if (state.stage === 'count-hand') {
				displayCards([], true, true, myHand);
				displayCards([], true, false, theirHand);
			}
		}
	});

	gameState.addWatcher(playedCards, (e) => {
		if (!e.detail?.playedCards) return;
		e.target.innerHTML = '';
		const ind = e.detail.playedCards.reverse().findIndex((c) => {
			return c.last;
		});
		e.detail.playedCards.reverse();

		const subset =
			ind === -1 ? e.detail.playedCards : e.detail.playedCards.slice(-ind);

		subset.forEach((c, i) => {
			if (!c.card) return;
			const card = createCard(c.card, false, true);
			const myCard = c.player === e.detail.myIndex;
			if (myCard) card.classList.add('my-card');
			else card.classList.add('their-card');
			e.target.appendChild(card);
		});
	});

	socket.on('crib-submitted', (data) => {
		[1, 2].forEach((n) => {
			const c = theirHand.querySelector('.card-container');
			c.remove();
		});
	});

	socket.on('card-played', (data) => {
		console.log(data.card);
		gameState.setState(data.gameState);
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
