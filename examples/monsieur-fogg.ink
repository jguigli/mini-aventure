// Public example: "A conversation with nested nodes", from the official ink documentation
// "Writing with ink" by inkle (section "Example: a conversation with nested nodes").
// Source: https://github.com/inkle/ink/blob/4011b8c0a01828c61dd2331613c1038a3a5f294b/Documentation/WritingWithInk.md#example-a-conversation-with-nested-nodes
// License: MIT, "Copyright (c) 2025 inkle Ltd." See https://github.com/inkle/ink/blob/4011b8c0a01828c61dd2331613c1038a3a5f294b/LICENSE.txt
// Copied verbatim (only the documentation's leading tab indentation was removed). It uses
// "weave" syntax (nested choices and gathers, no knots), which this app never generates:
// it is opened in text mode, played and explored, but not shown on the map.

- I looked at Monsieur Fogg
*	... and I could contain myself no longer.
	'What is the purpose of our journey, Monsieur?'
	'A wager,' he replied.
	* * 	'A wager!'[] I returned.
			He nodded.
			* * * 	'But surely that is foolishness!'
			* * *  'A most serious matter then!'
			- - - 	He nodded again.
			* * *	'But can we win?'
					'That is what we will endeavour to find out,' he answered.
			* * *	'A modest wager, I trust?'
					'Twenty thousand pounds,' he replied, quite flatly.
			* * * 	I asked nothing further of him then[.], and after a final, polite cough, he offered nothing more to me. <>
	* * 	'Ah[.'],' I replied, uncertain what I thought.
	- - 	After that, <>
*	... but I said nothing[] and <>
- we passed the day in silence.
- -> END
