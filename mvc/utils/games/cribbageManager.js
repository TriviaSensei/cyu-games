const { v4: uuidV4 } = require('uuid');
const GameManager = require('./_gameManager');
const CardDeck = require('../cardDeck');

const cardDelay = 300;

class CribbageManager extends GameManager {
	verifySettings(settings) {
		let message = '';

		if (settings.timer) {
			if (settings.time < 15 || settings.time > 60)
				message = 'Time per move must be between 15 and 60 seconds';
			else if (settings.reserve < 0 || settings.reserve > 10)
				message = 'Reserve time must be between 0 and 10 minutes';
		} else if (settings.target !== 61 && settings.target !== 121)
			message = 'Target must be 61 or 121.';

		if (message) throw new Error(message);
	}

	/**
	 * Game stages:
	 * Show opponent hand:
	 * - draw-for-crib
	 * - count-hand
	 * - count-crib
	 *
	 * Hide opponent hand:
	 * crib
	 * play
	 */

	sendGameUpdate() {
		this.gameState.players.forEach((p, i) => {
			if (!p.user) return;
			if (this.io)
				this.io
					.to(p.user.socketId)
					.emit('update-game-state', this.sanitizeGameState(i));
		});
	}

	startGame() {
		if (this.gameState.status !== 'waiting') return null;
		this.setGameState({
			active: true,
			status: 'pregame',
			message: {
				status: 'info',
				message: 'Game starting...',
				duration: this.pregameLength,
			},
		});
		this.sendGameUpdate();
		this.setGameState({ message: null });
		setTimeout(() => {
			//shuffle the deck
			this.deck.shuffle();
			this.setGameState({ status: 'pregame', stage: 'draw-for-crib' });
			const removedCards = [];
			this.gameState.playedCards = [];
			this.gameState.players.forEach((p, i) => {
				p.hand = [];
				//draw a card
				if (i === 0) p.hand.push(this.deck.drawCard());
				else {
					const other = this.gameState.players[0].hand[0];
					let card = this.deck.drawCard();
					while (card.value === other.value) {
						removedCards.push(card);
						card = this.deck.drawCard();
					}
					p.hand.push(card);
				}
			});
			if (
				this.gameState.players[0].hand[0].value <
				this.gameState.players[1].hand[0].value
			)
				this.gameState.dealer = 1;
			else this.gameState.dealer = 0;
			this.sendGameUpdate();
			this.deck.addRandom(removedCards);
			this.deck.addRandom(
				this.gameState.players.map((p) => {
					return p.hand[0];
				})
			);
			setTimeout(() => {
				this.startNewHand();
			}, this.pregameLength);
		}, this.pregameLength);
		return this.gameState;
	}

	startNewHand() {
		this.deck.shuffle();
		this.gameState.players.forEach((p) => {
			p.hand = this.deck.draw(6);
		});
		this.setGameState({
			status: 'playing',
			stage: 'crib',
			dealer: 1 - this.gameState.dealer,
		});
		this.sendGameUpdate();
		setTimeout(() => {
			this.startClock(0);
			this.startClock(1);
		}, 1800);
	}

	removePlayer(ind, reason) {
		console.log(`Removing player ${ind} (${reason})`);
		if ((ind !== 0) & (ind !== 1)) return this.gameState;

		const currentState = super.getGameState();
		if (!currentState.active && currentState.status !== 'playing')
			return this.gameState;

		const winner = 1 - ind;
		const endGameString = `${currentState.players[winner].user.name} wins (${reason})`;

		super.setGameState({
			status: 'ended',
			winner,
			endGameString,
			ranking: [
				{ ...currentState.players[winner], rank: 1 },
				{ ...currentState.players[1 - winner], rank: 2 },
			],
		});
		return {
			status: 'OK',
			gameState: this.getGameState(),
		};
	}

	handlePlayScoring() {
		this.gameState.scoring = [];
		//heels
		if (
			this.gameState.stage === 'crib' &&
			this.gameState.turnCard.rank === 'j'
		) {
			this.gameState.scoring.push('2 for heels');
			this.gameState.players[this.gameState.dealer].score += 2;
		}

		if (this.gameState.playedCards.length > 0) {
			const lastPlay = this.gameState.playedCards.slice(-1).pop();

			let points = 0;
			//15
			if (lastPlay.count === 15) {
				this.gameState.scoring.push('15 for 2');
				points += 2;
			}
			//pairs, triples, etc.
			let match = 0;
			if (lastPlay?.card) {
				for (var i = this.gameState.playedCards.length - 2; i >= 0; i--) {
					if (
						!this.gameState.playedCards[i].card ||
						this.gameState.playedCards[i].last
					)
						break;
					else if (
						this.gameState.playedCards[i].card?.rank === lastPlay.card.rank
					)
						match++;
					else break;
					if (match === 3) break;
				}
				switch (match) {
					case 1:
						points += 2;
						this.gameState.scoring.push('Pair for 2');
						break;
					case 2:
						points += 6;
						this.gameState.scoring.push('Triple for 6');
						break;
					case 3:
						points += 12;
						this.gameState.scoring.push('Quad for 12');
						break;
					default:
						break;
				}
			}

			//run
			let longestRun = 0;
			for (var i = 3; i <= this.gameState.playedCards.length; i++) {
				const subset = this.gameState.playedCards.slice(-i);

				if (
					subset.some((c) => {
						return !c.card;
					})
				)
					break;

				subset.sort((a, b) => {
					return a.card.value - b.card.value;
				});
				if (
					subset.every((c, j) => {
						return j === 0 || c.card.value === subset[j - 1].card.value + 1;
					})
				) {
					longestRun = i;
				}
			}
			if (longestRun >= 3) {
				points += longestRun;
				this.gameState.scoring.push(`Run of ${longestRun} for ${longestRun}`);
			}

			//31
			if (lastPlay.count === 31) {
				this.gameState.scoring.push('31 for 2');
				points += 2;
			}

			//go
			if (this.gameState.playedCards.length > 2) {
				const subset = this.gameState.playedCards.slice(-2);
				if (!subset[0].card && !subset[1].card) {
					points += 1;
					this.gameState.scoring.push('1 for go');
					this.gameState.playedCards[
						this.gameState.playedCards.length - 1
					].last = true;
				}
			}

			//last
			if (
				lastPlay.count !== 31 &&
				this.gameState.playedCards.reduce((p, c) => {
					if (c.card) return p + 1;
					return p;
				}, 0) >= 8
			) {
				points += 1;
				this.gameState.scoring.push('1 for last');
			}

			this.gameState.players[this.gameState.turn].score += points;
		}
	}

	startClock(player) {
		if (this.gameState.players[player].timeout) return;
		this.gameState.players[player].turnStart = Date.now();
		const timeLeft =
			this.gameState.players[player].time +
			this.gameState.players[player].reserve;

		this.gameState.players[player].timeout = setTimeout(async () => {
			this.setGameState({ status: 'ended', reason: 'timeout' });
			await this.handleEndGame();
		}, timeLeft);
	}

	stopClock(player) {
		if (!this.gameState.players[player].timeout) return;
		clearTimeout(this.gameState.players[player].timeout);
		this.gameState.players[player].timeout = null;
		const timeElapsed = Date.now() - this.gameState.players[player].turnStart;
		this.gameState.players[player].turnStart = null;
		if (timeElapsed > this.timerState.time) {
			this.gameState.players[player].reserve -=
				timeElapsed - this.timerState.time;
			this.gameState.players[player].time = this.timerState.time;
		}
	}

	scoreHands() {}

	checkForWin() {
		const winner = this.gameState.players.findIndex((p) => {
			return p.score >= this.settings.target;
		});
		if (winner === -1) return false;

		this.setGameState({
			status: 'ended',
			winner,
			reason: `${this.settings.target} points reached`,
		});
		return true;
	}

	handleEndGame = async () => {
		console.log('game ended');
	};

	sanitizeGameState(i) {
		return {
			...this.gameState,
			myIndex: i,
			crib: Array.isArray(this.gameState.crib)
				? this.gameState.crib.map((c) => null)
				: this.gameState.crib,
			players: this.gameState.players.map((p, j) => {
				return {
					...p,
					hand:
						i === j ||
						(this.gameState.stage !== 'crib' && this.gameState.stage !== 'play')
							? p.hand
							: p.hand.map((c) => null),
					timeout: null,
				};
			}),
		};
	}

	playMove = async (move) => {
		const currentState = super.getGameState();
		if (currentState.status !== 'playing') {
			return {
				status: 'fail',
				message: 'This game has ended',
			};
		}

		const user = move.user;
		let validMove = true;
		let message = '';
		let otherPlayer;
		if (currentState.stage === 'crib') {
			//must submit 2 distinct cards
			if (move.cards.length !== 2) {
				return {
					status: 'fail',
					message: 'You must select 2 cards',
				};
			} else if (
				move.cards[0].suit === move.cards[1].suit &&
				move.cards[0].rank === move.cards[1].rank
			) {
				return {
					status: 'fail',
					message: 'You must select 2 distinct cards',
				};
			}
			//verify that the cards are actually in the player's hand
			if (
				!this.gameState.players.some((p, i) => {
					if (p.user.id === user.id) {
						otherPlayer = 1 - i;
						if (p.hand.length !== 6) {
							validMove = false;
							message = 'You have already submitted a crib';
							return true;
						} else if (
							!move.cards.every((c) => {
								return p.hand.some((cd) => {
									return cd.rank === c.rank && cd.suit === c.suit;
								});
							})
						) {
							validMove = false;
							message = 'Invalid crib submitted';
						} else {
							move.cards.forEach((c) => {
								p.hand = p.hand.filter((cd) => {
									if (cd.rank !== c.rank || cd.suit !== c.suit) return true;
									if (!this.gameState.crib) this.gameState.crib = [];
									this.gameState.crib.push(c);
									return false;
								});
							});
						}
						return true;
					}
				})
			) {
				validMove = false;
				message = 'Player not found';
			}
			if (!validMove) {
				return {
					status: 'fail',
					message,
				};
			} else {
				/**
				 * move object (in moveList):
				 * {
				 * 		player: (0,1),
				 * 		card: {card object}, null if turn passed (go)
				 * 		count: (0, 1, ..., 31),
				 * 		scoring: e.g. "15 for 2", "31 for 2, Pair for 2", "1 for last"
				 * 		last: boolean
				 * }
				 */
				const other = this.gameState.players[otherPlayer].user;
				this.io.to(other.socketId).emit('crib-submitted', null);
				this.stopClock(1 - otherPlayer);
				//both players have submitted their cribs
				//turn the turn card
				if (this.gameState.crib.length === 4) {
					this.setGameState({
						turn: 1 - this.gameState.dealer,
						turnCard: this.deck.drawCard(),
						playedCards: [],
						count: 0,
					});
					this.handlePlayScoring();
					if (!this.checkForWin()) {
						setTimeout(() => {
							this.setGameState({ stage: 'play' });
							this.startClock(1 - this.gameState.dealer);
							this.sendGameUpdate();
						}, cardDelay);
					} else {
						setTimeout(() => {
							this.handleEndGame();
						}, cardDelay);
					}
				}
			}
		} else if (currentState.stage === 'play') {
			//make sure it's the right player's turn
			if (
				this.gameState.players[this.gameState.turn].user.id !== move.user.id
			) {
				return {
					status: 'fail',
					message: "It's not your turn.",
				};
			}
			//other player - will need to notify them when the play goes through (whether a card is played or it's a "go")
			const other = this.gameState.players[1 - this.gameState.turn];
			const lastPlay = this.gameState.playedCards.slice(-1).pop();
			let win;
			//is the move a go?
			if (!move.rank || !move.suit) {
				const topCard =
					this.gameState.playedCards.length > 0
						? this.gameState.playedCards.slice(-1).pop()
						: null;
				const currentCount = topCard?.last ? 0 : topCard.count;
				//does this player have a legal play in hand?
				if (
					this.gameState.players[this.gameState.turn].hand.some((c) => {
						const val = Math.min(10, c.value);
						if (val + currentCount <= 31) return true;
						return false;
					})
				) {
					return { status: 'fail', message: 'You have a legal play.' };
				} else {
					//this is a legal go
					this.gameState.playedCards.push({
						player: this.gameState.turn,
						card: null,
						count: currentCount,
						last: lastPlay.card ? false : true,
					});
					//score the play, if necessary
					this.handlePlayScoring();
					//check for win
					win = this.checkForWin();
					//flip the turn
					this.setGameState({ turn: 1 - this.gameState.turn });
					this.gameState.players.forEach((p, i) => {
						this.io.to(p.user.socketId).emit('card-played', {
							card: null,
							gameState: this.sanitizeGameState(i),
						});
					});
				}
			}
			//it's not a go - make sure the card is in the player's hand
			else if (
				!this.gameState.players.some((p) => {
					return (
						p.user.id === move.user.id &&
						p.hand.some((c) => {
							//if a card in the correct user's hand matches...
							if (c.rank === move.rank && c.suit === move.suit) {
								//make sure the count doesn't exceed 31
								const currentCount =
									!lastPlay || lastPlay.last ? 0 : lastPlay.count;
								if (
									this.gameState.playedCards.length > 0 &&
									currentCount + Math.min(10, c.value) > 31
								) {
									validMove = false;
									message = 'Invalid play - count may not exceed 31.';
									return true;
								}
								//move is valid - move the card to the played cards pile

								//stop the current player's clock
								this.stopClock(this.gameState.turn);

								//calculate the new count
								const newCount = currentCount + Math.min(10, c.value);
								//this one is last if we hit 31 or if no one has cards left
								const last =
									newCount === 31 ||
									this.gameState.players.every((p) => {
										return (
											p.hand.length === 0 ||
											(p.hand.length === 1 &&
												p.hand[0].rank === move.rank &&
												p.hand[0].suit === move.suit)
										);
									});
								//push the play to the stack
								this.gameState.playedCards.push({
									player: this.gameState.turn,
									card: c,
									count: newCount,
									last,
								});

								//score the play
								this.handlePlayScoring();
								//check if anyone has won
								win = this.checkForWin();
								//flip the turn
								this.setGameState({ turn: 1 - this.gameState.turn });

								return true;
							}
						})
					);
				})
			) {
				return {
					status: 'fail',
					message: `Invalid card played - ${move.rank}${move.suit}`,
				};
			} else {
				//a move was played - just remove the card from the player's hand
				this.gameState.players.some((p) => {
					if (p.user.id === move.user.id) {
						p.hand = p.hand.filter((c) => {
							return c.suit !== move.suit || c.rank !== move.rank;
						});
						return true;
					}
					return false;
				});
			}
			if (!validMove)
				return {
					status: 'fail',
					message,
				};

			if (!win) {
				//no one has won.
				//verify that there are cards left to be played
				if (
					this.gameState.players.every((p) => {
						return p.hand.length === 0;
					})
				) {
					//if not, score the hand
					this.setGameState({ stage: 'count-hand' });
					console.log(this.gameState);
					//notify the other player of the play
					if (move.suit && move.rank) {
						this.io.to(other.user.socketId).emit('card-played', {
							card: this.gameState.playedCards.slice(-1).pop().card,
							gameState: this.sanitizeGameState(this.gameState.turn),
						});
					} else {
						//on a go, we have to tell everyone because players do not initiate the "go" - the server figures it out.
						this.players.forEach((p, i) => {
							this.io.to(p.user.socketId).emit('card-played', {
								card: null,
								gameState: this.sanitizeGameState(i),
							});
						});
					}

					setTimeout(this.scoreHands, 1000);
				}
				//verify that the next player has a legal play (at least 1 card in hand that can be played)
				else {
					const lastPlay = this.gameState.playedCards.slice(-1).pop();
					const currentCount =
						lastPlay.count === 31 || lastPlay.last ? 0 : lastPlay.count;
					if (
						other.hand.some((c) => {
							const val = Math.min(10, c.value);
							return currentCount + val <= 31;
						})
					) {
						//notify the other player of the play
						this.io.to(other.user.socketId).emit('card-played', {
							card: lastPlay.card,
							gameState: this.sanitizeGameState(this.gameState.turn),
						});
						//start the clock for the new turn
						this.startClock(this.gameState.turn);
					} else {
						//no legal play but someone has cards left - "GO"
						setTimeout(async () => {
							await this.playMove({
								user: other.user,
								rank: null,
								suit: null,
							});
						}, cardDelay + 500);
					}
				}
			} else {
				setTimeout(() => {
					this.handleEndGame();
				}, 1000);
			}
		}

		return {
			status: 'OK',
			gameState: this.sanitizeGameState(1 - this.gameState.turn),
		};
	};

	startRematch() {
		return this.gameState;
	}

	constructor(settings, io) {
		super(settings, io);
		console.log('Initializing game manager for Cribbage');
		this.verifySettings(settings);
		this.gameName = 'cribbage';
		this.deck = new CardDeck();
		this.getTurn = (gameState) => {
			if (!gameState) return -1;
			return gameState.turnsCompleted % 2;
		};
		this.timerState = {
			time: settings.timer ? settings.time * 1000 : null,
			reserve: settings.timer ? settings.reserve * 60 * 1000 : 0,
		};
		this.timeoutFunction = async () => {
			this.stopClock(this.gameState.turn);
			this.setGameState({
				status: 'ended',
				reason: 'timeout',
			});
			await this.handleEndGame();
		};

		this.gameState = {
			active: false,
			status: 'waiting',
			stage: '',
			players: [
				{
					...this.timerState,
					timer: settings.timer,
					rematch: false,
					user: settings.host,
					hand: [],
					score: 0,
					turnStart: null,
					timeout: null,
				},
				{
					...this.timerState,
					timer: settings.timer,
					rematch: false,
					user: null,
					hand: [],
					score: 0,
					turnStart: null,
					timeout: null,
				},
			],
			handsCompleted: -1,
			turn: -1,
		};
	}
}

module.exports = CribbageManager;
