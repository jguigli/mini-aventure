# title: Le phare qui murmure
# reading_level: 11-12

-> phare

=== phare ===
# scene: phare
# scene_title: La voix dans la nuit
# emoji: 🗼
# mood: mystere
Chaque soir, Lina allume la lanterne du vieux phare. Ce soir, une voix douce monte de la mer. Elle répète son prénom, encore et encore. Le vent sent le sel et le secret.
+ [Monter au sommet #emoji: 🪜] Lina grimpe l'escalier en colimaçon jusqu'à la lanterne.
  -> sommet
+ [Descendre à la crique #emoji: 🏖️] Lina descend le sentier glissant jusqu'à la petite crique.
  -> crique

=== sommet ===
# scene: sommet
# scene_title: La lueur verte
# emoji: 🔭
# mood: tension
Au sommet, Lina pointe sa longue-vue vers les vagues. Une lueur verte danse sous l'eau, près des rochers. La voix devient plus forte, presque suppliante.
+ [Faire signe avec la lanterne #emoji: 🏮] Lina saisit la poignée de la lanterne et la tourne vers la mer.
  -> signal
+ [Ouvrir le carnet du grand-père #emoji: 📓] Lina sort le vieux carnet du tiroir de la salle de veille.
  -> carnet
+ [Courir vers les rochers #emoji: 🪨] Lina dévale l'escalier et court vers les rochers.
  -> crique

=== crique ===
# scene: crique
# scene_title: Le coquillage qui chante
# emoji: 🐚
# mood: mystere
Les galets crissent sous les bottes de Lina. Dans une flaque, un coquillage nacré vibre comme un cœur. La voix sort de là, claire et fragile.
+ [Porter le coquillage jusqu'aux vagues #emoji: 🌊] Lina serre le coquillage contre elle et avance dans l'écume.
  -> fin_lumiere
+ [Le garder dans sa poche #emoji: 🎒] Lina glisse le coquillage dans sa poche et s'assoit sur un rocher.
  -> fin_brume
+ [Remonter au sommet #emoji: 🗼] Lina remonte au sommet, le cœur battant.
  -> sommet

=== carnet ===
# scene: carnet
# scene_title: Le carnet du gardien
# emoji: 📓
# mood: calme
Lina feuillette le carnet de son grand-père, l'ancien gardien. Un dessin montre une sirène enfermée dans un coquillage. Une note dit : « Celle qui chante doit retrouver la marée haute. »
+ [Filer à la crique #emoji: 🔦] Lina attrape sa lampe et file vers la crique.
  -> crique
+ [Attendre le lever du jour #emoji: 🛏️] Lina referme le carnet et décide d'attendre le matin.
  -> fin_brume

=== signal ===
# scene: signal
# scene_title: Trois éclats de lumière
# emoji: 🏮
# mood: tension
Lina fait clignoter la lanterne trois fois. Sous l'eau, la lueur verte répond, puis glisse vers le rivage. Mais la marée commence déjà à descendre.
+ [Rejoindre la lueur à la crique #emoji: 🥾] Lina court vers le rivage, là où brille la lueur.
  -> crique
+ [Attendre la prochaine marée #emoji: ⏳] Lina s'assoit et regarde la mer descendre.
  -> fin_brume

=== fin_lumiere ===
# scene: fin_lumiere
# scene_title: La voix libérée
# emoji: ☀️
# mood: joie
# ending: A
# ending_label: La voix libérée
Lina pose le coquillage sur la vague. Une sirène minuscule en jaillit en riant. Depuis, le phare brille d'une lueur verte les nuits de pleine lune.
-> END

=== fin_brume ===
# scene: fin_brume
# scene_title: La voix perdue
# emoji: 🌫️
# mood: sombre
# ending: B
# ending_label: La voix perdue
La marée se retire et la voix s'éteint doucement. Au matin, il ne reste qu'un coquillage silencieux. Lina le pose près de la lanterne, en espérant l'entendre un jour.
-> END
