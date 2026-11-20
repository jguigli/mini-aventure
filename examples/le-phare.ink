# title: Le phare qui murmure
# reading_level: 11-12

-> phare

=== phare ===
# scene: phare
# emoji: 🗼
# mood: mystere
Chaque soir, Lina allume la lanterne du vieux phare. Ce soir, une voix douce monte de la mer. Elle répète son prénom, encore et encore. Le vent sent le sel et le secret.
+ [Monter au sommet #emoji: 🪜] -> sommet
+ [Descendre à la crique #emoji: 🏖️] -> crique

=== sommet ===
# scene: sommet
# emoji: 🔭
# mood: tension
Au sommet, Lina pointe sa longue-vue vers les vagues. Une lueur verte danse sous l'eau, près des rochers. La voix devient plus forte, presque suppliante.
+ [Faire signe avec la lanterne #emoji: 🏮] -> signal
+ [Ouvrir le carnet du grand-père #emoji: 📓] -> carnet
+ [Courir vers les rochers #emoji: 🪨] -> crique

=== crique ===
# scene: crique
# emoji: 🐚
# mood: mystere
Les galets crissent sous les bottes de Lina. Dans une flaque, un coquillage nacré vibre comme un cœur. La voix sort de là, claire et fragile.
+ [Porter le coquillage jusqu'aux vagues #emoji: 🌊] -> fin_lumiere
+ [Le garder dans sa poche #emoji: 🎒] -> fin_brume
+ [Remonter au sommet #emoji: 🗼] -> sommet

=== carnet ===
# scene: carnet
# emoji: 📓
# mood: calme
Lina feuillette le carnet de son grand-père, l'ancien gardien. Un dessin montre une sirène enfermée dans un coquillage. Une note dit : « Celle qui chante doit retrouver la marée haute. »
+ [Filer à la crique #emoji: 🔦] -> crique
+ [Attendre le lever du jour #emoji: 🛏️] -> fin_brume

=== signal ===
# scene: signal
# emoji: 🏮
# mood: tension
Lina fait clignoter la lanterne trois fois. Sous l'eau, la lueur verte répond, puis glisse vers le rivage. Mais la marée commence déjà à descendre.
+ [Rejoindre la lueur à la crique #emoji: 🥾] -> crique
+ [Attendre la prochaine marée #emoji: ⏳] -> fin_brume

=== fin_lumiere ===
# scene: fin_lumiere
# emoji: ☀️
# mood: joie
# ending: A
# ending_label: La voix libérée
Lina pose le coquillage sur la vague. Une sirène minuscule en jaillit en riant. Depuis, le phare brille d'une lueur verte les nuits de pleine lune.
-> END

=== fin_brume ===
# scene: fin_brume
# emoji: 🌫️
# mood: sombre
# ending: B
# ending_label: La voix perdue
La marée se retire et la voix s'éteint doucement. Au matin, il ne reste qu'un coquillage silencieux. Lina le pose près de la lanterne, en espérant l'entendre un jour.
-> END
