class CardDeck {
	cardsLeft() {
		return this.deck.length;
	}

	//removes a card from the deck and returns it
	drawCard() {
		const cardsLeft = this.cardsLeft();
		if (cardsLeft === 0) return null;
		const card = this.deck.pop();
		return card;
	}

	//returns the top card of the deck without removing it
	top() {
		if (this.deck.length === 0) return null;
		return { ...this.deck[this.deck.length - 1] };
	}

	//returns the bottom card of the deck without removing it
	bottom() {
		if (this.deck.length === 0) return null;
		return { ...this.deck[0] };
	}

	//returns an array of n random cards, without removing them. If n > deck size, it returns the entire remaining deck in random order
	randomCards(n) {
		const cardsLeft = this.cardsLeft();
		const toReturn = [];
		for (var i = 0; i < Math.min(cardsLeft, n); i++) {
			const ind = Math.floor(Math.random() * (cardsLeft - i));
			toReturn.push({ ...this.deck[ind] });
		}
	}

	//draws and removes n cards at random
	draw(n) {
		console.log(`drawing ${n}`);
		const toReturn = [];
		for (var i = 0; i < n; i++) {
			toReturn.push(this.drawCard());
		}
		console.log(toReturn);
		return toReturn;
	}

	//returns one random card without removing it from the deck
	randomCard() {
		return randomCards(1)[0];
	}

	//inserts a card back into the deck...
	//on top
	addToTop(cards) {
		if (Array.isArray(cards)) {
			cards.forEach((c) => {
				this.addToTop(c);
			});
		} else this.deck.push(cards);
	}
	//on the bottom
	addToBottom(cards) {
		if (Array.isArray(cards)) {
			cards.reverse().forEach((c) => {
				this.addToBottom(c);
			});
		} else this.deck.unshift(cards);
	}
	//randomly
	addRandom(cards) {
		console.log(`Adding ${cards}`);
		if (Array.isArray(cards)) {
			cards.forEach((c) => {
				this.addRandom(c);
			});
		} else {
			const cardsLeft = this.cardsLeft();
			const ind = Math.floor(Math.random() * (cardsLeft + 1));
			this.deck.splice(ind, 0, cards);
			console.log(this.cardsLeft());
		}
	}

	//shuffles the cards in the deck (not including the ones removed) into a random order. If you've drawn cards, you have to add
	//them back to the deck using one of the above methods before shuffling it back in, if you want it in there.
	shuffle() {
		console.log('shuffling');
		this.deck.forEach((c) => {
			c.order = Math.random();
		});
		this.deck.sort((a, b) => {
			return a.order - b.order;
		});
		this.deck.forEach((c) => {
			delete c.order;
		});
		console.log(this.cardsLeft());
	}

	constructor(...args) {
		this.deck = [];
		let decks, filter;
		if (args.length === 0) decks = 1;
		else {
			decks = Number(args[0]) || 1;
			if (args.length !== 1) filter = args[1];
		}

		for (var deck = 1; deck <= decks; deck++) {
			for (var value = 1; value <= 13; value++) {
				['s', 'h', 'd', 'c'].forEach((suit) => {
					const rank =
						value === 1
							? 'a'
							: value <= 10
							? `${value}`
							: value === 11
							? 'j'
							: value === 12
							? 'q'
							: 'k';
					this.deck.push({
						rank,
						suit,
						value,
						card: `${rank.toUpperCase()}${suit.toUpperCase()}`,
					});
				});
			}
		}

		if (filter && (typeof filter).toLowerCase() === 'function') {
			this.deck = this.deck.filter(filter);
		}
	}
}
module.exports = CardDeck;
