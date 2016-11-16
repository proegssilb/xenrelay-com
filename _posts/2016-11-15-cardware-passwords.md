---
layout: post
title: 'Introducing: Cardware Password Generation'
date: '2016-11-15T19:46:00.000-05:00'
author: David Bliss
tags:
- passwords
- security
- playing-cards
---

I'm sure almost everyone has heard of [XKCD Passwords][xk] by
now. Several people on the internet may have also heard of [diceware][dw]. After
some digging, I did find a person who wrote up a method for using
[playing cards][pcp], but it doesn't use a full deck of cards, and requires
reshuffling after every card drawn. I found this rather unusable. Surely we can
do better with a deck of cards?

Well, yes. Let me introduce what I'm going to call "cardware," for want of
creativity.

# Using Cardware

Shuffle your deck (7 riffle shuffles), and draw 3 cards. Let's take a look at an
excerpt [from the wordlist][cw]:

    7c 4d 8s    nabla
    7c 4d 9s    woodlawn
    7c 4d 10s   edvard
    7c 4d Js    grabbed
    7c 4d Qs    genitive
    7c 4d Ks    annum
    7c 4d Ah    soma
    7c 4d 2h    emitted
    7c 4d 3h    dermot
    7c 4d 4h    smoothly

The first card drawn in each of these is the Seven of **C**lubs. The other suits
are similarly abbreviated; **S**pades, **D**iamonds, and **H**earts. Number cards
are pretty easy, but face cards need to be similarly abbreviated. So, we have
**A**ce, **J**ack, **Q**ueen, and **K**ing. The word list is described with first
card drawn on the left, last drawn on the right. If you drew a Seven of Clubs,
a Four of Diamonds, and Ace of Hearts, your word would be "soma" (see the
excerpt above).

# Why should I do this?

First, we need to define what makes a "better" method of
generating passwords. Diceware has a wordlist of 7,776 words with which it uses
to create a passphrase. PCP, as the website I linked to calls it, uses a 10,000
entry wordlist. Both of these systems use a physical prop to generate "random"
words from the wordlist. By picking multiple words, we can dramatically increase
the number of passwords possible without increasing the length of the wordlist.

Mathematically, we can predict how many different passwords failing to shuffle
the deck of cards each time will let us get. How long of a wordlist do we need?
[Permutations][perms] of *n* cards gives us the following numbers:

* **3** 132,600
* **4** 6,497,400

I'm not sure there's 6.5 million words that people commonly use, but there is
[a list of 479,829 English words][enwrds] easily available. So, finding enough
words is no problem. How many different passwords can we generate? Well,
in terms of probability, there is no difference between drawing 3 cards twice
without replacement and drawing 6 cards without replacement. So, let's first
list out how well diceware does:

 - **5 words**: 2.8430 &middot; 10<sup>19</sup>
 - **6 words**: 2.2107 &middot; 10<sup>23</sup>
 - **7 words**: 1.7191 &middot; 10<sup>27</sup>
 - **8 words**: 1.3368 &middot; 10<sup>31</sup>
 - **9 words**: 1.0395 &middot; 10<sup>35</sup>
 - **10 words**: 8.0828 &middot; 10<sup>38</sup>

PCP lists how many passwords it can generate [on its site][pcp], but here's a
copy of the info as of time of writing:

 - **5 words**: 10<sup>20</sup>
 - **6 words**: 10<sup>24</sup>
 - **7 words**: 10<sup>28</sup>
 - **8 words**: 10<sup>32</sup>
 - **9 words**: 10<sup>36</sup>
 - **10 words**: 10<sup>40</sup>

Note that PCP is slightly less than an order of magnitude more passwords than
diceware for the same number of cards.

Now, how well can we do if we use the full deck of cards, but don't shuffle
every time? Here's the list, assuming you draw 3 cards per word:

 - **4 words**: 9.8856 &middot; 10<sup>19</sup>
 - **5 words**: 5.8602 &middot; 10<sup>24</sup>
 - **6 words**: 2.7320 &middot; 10<sup>29</sup>
 - **7 words**: 9.8090 &middot; 10<sup>33</sup>
 - **8 words**: 2.6455 &middot; 10<sup>38</sup>

So, we can basically cut off 1 word from diceware, and maintain or improve the
number of passwords we could generate. That just leaves [making a wordlist][cw].
For those that care, I posted the [relevant code on github][wcs].

[xk]: https://xkcd.com/936/
[dw]: http://world.std.com/~reinhold/diceware.html
[pcp]: http://www.webplaces.org/passwords/playing-cards-passphrase-method.htm
[perms]: https://en.wikipedia.org/wiki/Permutation
[enwrds]: https://github.com/dwyl/english-words
[cw]: {{ "/files/cardsWordList.txt" | relative_url }}
[wcs]: https://github.com/proegssilb/wikipedia-wordcount
