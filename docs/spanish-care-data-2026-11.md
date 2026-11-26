# The care dataset in Spanish: November 2026 proposal

The last part of Spanish for the 1.3 Monstera release
([roadmap](roadmap.md#monstera-simple-by-default-planned)): the app, its emails and its
numbers are in Spanish already (#260–#264), but the care guide still shows plant names and
care profiles in English. This proposes Spanish for both, for the maintainer to decide on
before anything in `data/care/` changes, as for the [care](care-review-2026-11.md) and
[toxicity](toxicity-review-2026-11.md) reviews. **Decided on 2026-11-26**
([decisions](#decided-2026-11-26)): the common names are applied (dataset 2026.11.8); the
care profiles' and notes' Spanish waits for a native speaker to read it.

- **Common names** from Wikidata (CC0, so they can go into the CC BY-SA dataset): **149 names
  for 109 of the 321 taxa** (47 genera, 62 species). 21 more names were found and left out,
  each with a reason. 192 taxa have no usable Spanish name there.
- **Care profiles:** Spanish for each profile's name, description and notes (31 profiles,
  72 texts), and for the 41 distinct notes in `genera.yaml` (mostly toxicity notes).
- **No code or schema change is needed for the data.** The dataset already keeps text per
  language (`name`, `description`, `notes`) and common names per language code, and the app
  already shows the person's language, or English. This corrects mazelado/sunfleck#262,
  which said translating the profiles would need a schema change.

## How the names were found

- **Fetched on 2026-11-26** from Wikidata's query service, by each taxon's scientific name
  (P225). 318 of the 321 were found.
- **Three places on each item were read:** the taxon common name (P1843) in Spanish, the
  Spanish label, and the Spanish aliases. P1843 alone gave names for only 38 taxa, so the
  label and aliases were read too. They mix real common names with old Latin synonyms
  ("*Serangium*", "*Tornelia*" for *Monstera*), so every one was read by hand.
- **Only names on the taxon's own item are proposed.** Nothing is added from memory or other
  sources, even where a well-known name is missing (*taro*, *alegría de la casa*). Wikidata's
  spelling is kept, except for accents it leaves out, and plurals made singular ("Bojes" →
  "boj"): each such change is noted.
- **At most three names, the most widespread first,** as the README asks ("most common
  first"). The first is the one the care guide shows. Where Spain and Latin America differ,
  both are kept, as the app's Spanish is one translation for every country
  ([translating](translating.md#spanish)): *patata* and *papa*, *aguacate* and *palta*.
- **Lower case**, as in English, except names of people and places (*Adán*, *Moisés*,
  *Venus*, *Norfolk*).

## Decisions for the maintainer

### 1. Plants without a Spanish name

192 taxa have no Spanish name, and today the care guide shows their **English** names to
someone using Spanish: "Swiss cheese plant", "peace lily", "spider plant" (for those three,
this proposal adds Spanish ones). Search isn't affected either way: it matches names in every
language.

| Option | Scope | What a Spanish speaker sees for *Hosta* |
|---|---|---|
| A. Keep English as the fallback (today) | None | *Hosta* · "hosta, plantain lily" |
| **B. No common name in other languages: only the scientific name** (recommended) | A small change in `taxonomy/models.py` (`translated_names`), with tests | *Hosta* |
| C. English, marked as English | The same change, and a label in the app | *Hosta* · "hosta, plantain lily (English)" |

**Recommended: B.** An English name inside Spanish text is harder to read than the
scientific name, which Spanish-speaking gardeners use anyway for many of these (*hosta*,
*echeveria*, *calathea*). English names stay searchable.

### 2. Regional names

Some names are used in one country or region only: *bejeque* (*Aeonium*, the Canaries),
*cinta* (spider plant, Spain), *suelda con suelda* (*Tradescantia fluminensis*). They're
proposed, as Wikidata gives no other. Some others are left out, as they'd confuse most
people (*tabaiba* for every *Euphorbia*, *China* for busy Lizzie; see
[not proposed](#found-on-wikidata-but-not-proposed)).

- **A. As proposed** (recommended): keep a regional name when it's the only one.
- **B. Leave out every regional name**, so those taxa show what decision 1 chooses.

### 3. The care profiles' text

The [Spanish below](#care-profiles) was written by Claude from the English, following the
app's glossary. It's a translation, not new care advice: every value stays as reviewed.

- **A. Apply it after a native speaker has read it** (recommended): the same as for the
  app's Spanish.
- **B. Apply it now**, and correct it as people report problems.
- **C. Leave the profiles in English for 1.3.**

Whichever is chosen, the profile `status: reviewed` stays as it is: it's about the values and
their sources, not the translation.

### 4. Toxicity notes

The [notes](#notes-in-generayaml) are mostly the names of chemicals ("Saponinas", "Oxalatos de
calcio insolubles"), but some matter to a pet's owner: "Toxina desconocida; puede causar
insuficiencia renal en los gatos". They're translated with the profiles (decision 3), but
can be decided on their own.

### Decided (2026-11-26)

1. **Plants without a Spanish name: only the scientific name** (option B). In any language
   other than English, a plant without common names in that language shows none, so it's
   shown by its scientific name. Applied in `translated_names` (`taxonomy/models.py`).
2. **Regional names: as proposed** (option A). All 149 names are applied.
3. **The care profiles' Spanish: after a native speaker has read it** (option A). Not
   applied yet; the profiles stay in English until then.
4. **Toxicity notes: the same as the profiles.** Not applied yet.

## Also noted

- **Accents in search:** the search matches exact text, so "arandano" doesn't find
  *arándano azul*. Spanish speakers often type without accents on a phone. Making the search
  ignore accents is a small change in `taxonomy/selectors.py`, for its own PR.

## Common names

Proposed Spanish names, with the Wikidata item each comes from. "English" shows the dataset's
first English names, for comparison.

### On the genus

| Genus | English | Proposed Spanish | Wikidata | Note |
|---|---|---|---|---|
| *Philodendron* | philodendron | **filodendro** | [Q131880](https://www.wikidata.org/wiki/Q131880) |  |
| *Anthurium* | anthurium, flamingo flower | **anturio** | [Q239835](https://www.wikidata.org/wiki/Q239835) |  |
| *Dieffenbachia* | dumb cane | **diefembaquia, lotería** | [Q738915](https://www.wikidata.org/wiki/Q738915) |  |
| *Spathiphyllum* | peace lily | **cuna de Moisés** | [Q132632](https://www.wikidata.org/wiki/Q132632) | Wikidata writes it without the accent |
| *Caladium* | angel wings | **caladio** | [Q1521382](https://www.wikidata.org/wiki/Q1521382) |  |
| *Hedera* | ivy | **hiedra, yedra** | [Q61652398](https://www.wikidata.org/wiki/Q61652398), [Q26771](https://www.wikidata.org/wiki/Q26771) |  |
| *Hoya* | wax plant, hoya | **planta de cera** | [Q157749](https://www.wikidata.org/wiki/Q157749) | Wikidata has the plural |
| *Dracaena* | dragon tree, dracaena | **dracena** | [Q655798](https://www.wikidata.org/wiki/Q655798), [Q158009](https://www.wikidata.org/wiki/Q158009) |  |
| *Strelitzia* | bird of paradise | **flor de pajarito** | [Q147888](https://www.wikidata.org/wiki/Q147888) |  |
| *Araucaria* |  | **araucaria** | [Q157214](https://www.wikidata.org/wiki/Q157214) | Wikidata has the plural |
| *Coffea* | coffee plant | **cafeto** | [Q156354](https://www.wikidata.org/wiki/Q156354) |  |
| *Begonia* | begonia | **begonia** | [Q158617](https://www.wikidata.org/wiki/Q158617) | Wikidata has the plural |
| *Sedum* | stonecrop | **sedo** | [Q156851](https://www.wikidata.org/wiki/Q156851) |  |
| *Aeonium* | aeonium | **bejeque** | [Q152874](https://www.wikidata.org/wiki/Q152874) | Canarian name |
| *Agave* | agave, century plant | **agave, maguey** | [Q155874](https://www.wikidata.org/wiki/Q155874) |  |
| *Lithops* | living stones | **piedra viva, planta piedra** | [Q133283](https://www.wikidata.org/wiki/Q133283) | Wikidata has the plural too |
| *Opuntia* | prickly pear | **nopal, chumbera, tuna** | [Q158991](https://www.wikidata.org/wiki/Q158991) | Wikidata has the plurals |
| *Ferocactus* | barrel cactus | **cactus de barril** | [Q131727](https://www.wikidata.org/wiki/Q131727) |  |
| *Oncidium* | dancing lady orchid | **dama danzante** | [Q133754](https://www.wikidata.org/wiki/Q133754) |  |
| *Cattleya* | cattleya | **catleya** | [Q133733](https://www.wikidata.org/wiki/Q133733), [Q21441833](https://www.wikidata.org/wiki/Q21441833) |  |
| *Cymbidium* | boat orchid | **orquídea barco** | [Q843914](https://www.wikidata.org/wiki/Q843914), [Q5199431](https://www.wikidata.org/wiki/Q5199431) |  |
| *Paphiopedilum* | slipper orchid | **sandalia de Venus** | [Q131523](https://www.wikidata.org/wiki/Q131523) | Wikidata has the plural |
| *Ananas* | pineapple, bromeliad | **piña** | [Q147316](https://www.wikidata.org/wiki/Q147316) |  |
| *Tillandsia* | air plant | **clavel del aire** | [Q157270](https://www.wikidata.org/wiki/Q157270) |  |
| *Dionaea* | Venus flytrap | **atrapamoscas** | [Q12311673](https://www.wikidata.org/wiki/Q12311673), [Q4118972](https://www.wikidata.org/wiki/Q4118972) |  |
| *Drosera* | sundew | **rocío de sol** | [Q266](https://www.wikidata.org/wiki/Q266) |  |
| *Nepenthes* | tropical pitcher plant, monkey cup | **planta de jarra** | [Q217530](https://www.wikidata.org/wiki/Q217530) | Wikidata has the plural |
| *Thymus* | thyme | **tomillo** | [Q131224](https://www.wikidata.org/wiki/Q131224), [Q7799649](https://www.wikidata.org/wiki/Q7799649) |  |
| *Lavandula* | lavender | **lavanda** | [Q171892](https://www.wikidata.org/wiki/Q171892) |  |
| *Fragaria* | strawberry | **fresa, frutilla** | [Q745](https://www.wikidata.org/wiki/Q745) |  |
| *Citrus* | citrus | **cítricos** | [Q81513](https://www.wikidata.org/wiki/Q81513) |  |
| *Hydrangea* | hydrangea | **hortensia** | [Q155997](https://www.wikidata.org/wiki/Q155997) |  |
| *Rosa* | rose | **rosal** | [Q34687](https://www.wikidata.org/wiki/Q34687) |  |
| *Buxus* | box, boxwood | **boj** | [Q158703](https://www.wikidata.org/wiki/Q158703) | Wikidata has the plural |
| *Rhododendron* | rhododendron, azalea | **rododendro** | [Q189393](https://www.wikidata.org/wiki/Q189393) |  |
| *Camellia* | camellia | **camelia** | [Q212815](https://www.wikidata.org/wiki/Q212815) |  |
| *Viburnum* | viburnum | **viburno** | [Q158492](https://www.wikidata.org/wiki/Q158492) |  |
| *Ilex* | holly | **acebo** | [Q117085](https://www.wikidata.org/wiki/Q117085) |  |
| *Geranium* | cranesbill, hardy geranium | **geranio** | [Q157211](https://www.wikidata.org/wiki/Q157211) |  |
| *Hemerocallis* | daylily | **lirio de día** | [Q156275](https://www.wikidata.org/wiki/Q156275) |  |
| *Iris* | iris | **lirio** | [Q156901](https://www.wikidata.org/wiki/Q156901), [Q2260419](https://www.wikidata.org/wiki/Q2260419) |  |
| *Paeonia* | peony | **peonía** | [Q147105](https://www.wikidata.org/wiki/Q147105), [Q123594687](https://www.wikidata.org/wiki/Q123594687) |  |
| *Tagetes* | marigold | **clavel chino** | [Q147552](https://www.wikidata.org/wiki/Q147552) |  |
| *Pelargonium* | geranium, pelargonium | **pelargonio** | [Q146118](https://www.wikidata.org/wiki/Q146118) | Many Spanish speakers call these geranio, which Wikidata gives Geranium |
| *Tulipa* | tulip | **tulipán** | [Q93201](https://www.wikidata.org/wiki/Q93201) |  |
| *Narcissus* | daffodil | **narciso** | [Q29465](https://www.wikidata.org/wiki/Q29465) |  |
| *Hyacinthus* | hyacinth | **jacinto** | [Q158758](https://www.wikidata.org/wiki/Q158758) |  |

### On the species

| Species | English | Proposed Spanish | Wikidata | Note |
|---|---|---|---|---|
| *Monstera deliciosa* | Swiss cheese plant, split-leaf philodendron | **costilla de Adán, cerimán, mano de tigre** | [Q161077](https://www.wikidata.org/wiki/Q161077) |  |
| *Epipremnum aureum* | golden pothos, devil's ivy | **potus** | [Q161809](https://www.wikidata.org/wiki/Q161809) |  |
| *Maranta leuconeura* | prayer plant | **planta de la oración, maranta** | [Q6754829](https://www.wikidata.org/wiki/Q6754829) |  |
| *Chlorophytum comosum* | spider plant, airplane plant | **cinta** | [Q1164349](https://www.wikidata.org/wiki/Q1164349) | The usual name in Spain |
| *Tradescantia fluminensis* | small-leaf spiderwort | **suelda con suelda** | [Q601079](https://www.wikidata.org/wiki/Q601079) |  |
| *Hedera helix* | English ivy, common ivy | **hiedra común, hiedra trepadora** | [Q26354](https://www.wikidata.org/wiki/Q26354) |  |
| *Hoya carnosa* | wax plant, porcelain flower | **flor de nácar** | [Q134347](https://www.wikidata.org/wiki/Q134347) |  |
| *Ficus elastica* | rubber plant, rubber tree | **árbol del caucho, gomero, árbol de la goma** | [Q160576](https://www.wikidata.org/wiki/Q160576) |  |
| *Ficus benjamina* | weeping fig | **benjamina** | [Q275160](https://www.wikidata.org/wiki/Q275160) |  |
| *Dracaena fragrans* | corn plant | **tronco del Brasil** | [Q133690](https://www.wikidata.org/wiki/Q133690) |  |
| *Pachira aquatica* | money tree, Guiana chestnut | **castaño de Guinea** | [Q310500](https://www.wikidata.org/wiki/Q310500) |  |
| *Persea americana* | avocado, alligator pear | **aguacate, palta** | [Q37153](https://www.wikidata.org/wiki/Q37153), [Q133620833](https://www.wikidata.org/wiki/Q133620833) |  |
| *Strelitzia reginae* | bird of paradise, crane flower | **ave del paraíso, esterlicia** | [Q148904](https://www.wikidata.org/wiki/Q148904) |  |
| *Araucaria heterophylla* | Norfolk Island pine | **pino de la isla Norfolk** | [Q161070](https://www.wikidata.org/wiki/Q161070) |  |
| *Coffea arabica* | coffee plant, Arabian coffee | **cafeto de Arabia** | [Q47685](https://www.wikidata.org/wiki/Q47685) |  |
| *Dypsis lutescens* | areca palm, butterfly palm | **palmera amarilla** | [Q1535705](https://www.wikidata.org/wiki/Q1535705) |  |
| *Crassula ovata* | jade plant, money plant | **árbol de jade, jade** | [Q157299](https://www.wikidata.org/wiki/Q157299) |  |
| *Aloe vera* | aloe vera, medicinal aloe | **sábila** | [Q80079](https://www.wikidata.org/wiki/Q80079) | Wikidata writes sávila; the RAE prefers sábila |
| *Euphorbia milii* | crown of thorns | **corona de Cristo, corona de espinas** | [Q148829](https://www.wikidata.org/wiki/Q148829) |  |
| *Ceropegia woodii* | string of hearts, rosary vine | **collar de corazones** | [Q148960](https://www.wikidata.org/wiki/Q148960) |  |
| *Opuntia microdasys* | bunny ears cactus | **orejas de conejo, nopal cegador** | [Q310523](https://www.wikidata.org/wiki/Q310523) |  |
| *Ananas comosus* | pineapple | **piña, ananá** | [Q1493](https://www.wikidata.org/wiki/Q1493) |  |
| *Tillandsia usneoides* | Spanish moss | **heno, barba de viejo, musgo español** | [Q311524](https://www.wikidata.org/wiki/Q311524) | Wikidata writes barba del viejo |
| *Dionaea muscipula* | Venus flytrap | **Venus atrapamoscas, dionea atrapamoscas** | [Q155825](https://www.wikidata.org/wiki/Q155825) |  |
| *Salvia rosmarinus* | rosemary | **romero** | [Q102240169](https://www.wikidata.org/wiki/Q102240169) |  |
| *Salvia officinalis* | common sage, garden sage | **salvia** | [Q1111359](https://www.wikidata.org/wiki/Q1111359) |  |
| *Thymus vulgaris* | common thyme, garden thyme | **tomillo, tomillo común** | [Q148668](https://www.wikidata.org/wiki/Q148668) |  |
| *Lavandula angustifolia* | English lavender | **espliego común** | [Q42081](https://www.wikidata.org/wiki/Q42081) | Lavanda is on the genus's item |
| *Origanum vulgare* | oregano | **orégano** | [Q134283](https://www.wikidata.org/wiki/Q134283) |  |
| *Laurus nobilis* | bay laurel, sweet bay | **laurel, laurel común** | [Q26006](https://www.wikidata.org/wiki/Q26006) |  |
| *Olea europaea* | olive tree | **olivo** | [Q37083](https://www.wikidata.org/wiki/Q37083) |  |
| *Ocimum basilicum* | basil, sweet basil | **albahaca** | [Q38859](https://www.wikidata.org/wiki/Q38859) |  |
| *Petroselinum crispum* | parsley | **perejil** | [Q25284](https://www.wikidata.org/wiki/Q25284) |  |
| *Coriandrum sativum* | coriander, cilantro | **cilantro, coriandro** | [Q41611](https://www.wikidata.org/wiki/Q41611) |  |
| *Mentha spicata* | spearmint | **hierbabuena, menta** | [Q160114](https://www.wikidata.org/wiki/Q160114) |  |
| *Anethum graveolens* | dill | **eneldo** | [Q26686](https://www.wikidata.org/wiki/Q26686) |  |
| *Solanum lycopersicum* | tomato | **tomatera** | [Q20009670](https://www.wikidata.org/wiki/Q20009670), [Q23501](https://www.wikidata.org/wiki/Q23501) | The plant; the fruit is tomate |
| *Solanum melongena* | aubergine, eggplant | **berenjena** | [L1375748-S1](https://www.wikidata.org/wiki/L1375748-S1), [Q7540](https://www.wikidata.org/wiki/Q7540) |  |
| *Solanum tuberosum* | potato | **patata, papa** | [Q10998](https://www.wikidata.org/wiki/Q10998) |  |
| *Capsicum annuum* | sweet pepper, bell pepper | **pimiento morrón, ají, chile** | [Q1380](https://www.wikidata.org/wiki/Q1380), [Q122235129](https://www.wikidata.org/wiki/Q122235129) |  |
| *Cucumis sativus* | cucumber | **pepino común** | [L1371458-S1](https://www.wikidata.org/wiki/L1371458-S1), [Q23425](https://www.wikidata.org/wiki/Q23425) |  |
| *Cucumis melo* | melon | **melón** | [Q81602](https://www.wikidata.org/wiki/Q81602) |  |
| *Cucurbita pepo* | courgette, zucchini | **calabacín, zapallo italiano** | [Q7229863](https://www.wikidata.org/wiki/Q7229863) |  |
| *Phaseolus vulgaris* | French bean, green bean | **frijol, judía, poroto** | [Q42339](https://www.wikidata.org/wiki/Q42339) |  |
| *Phaseolus coccineus* | runner bean | **ayocote** | [Q159753](https://www.wikidata.org/wiki/Q159753) |  |
| *Pisum sativum* | pea, garden pea | **guisante, arveja, chícharo** | [Q25237](https://www.wikidata.org/wiki/Q25237) |  |
| *Lactuca sativa* | lettuce | **lechuga** | [Q83193](https://www.wikidata.org/wiki/Q83193) |  |
| *Spinacia oleracea* | spinach | **espinaca** | [L1371245-S1](https://www.wikidata.org/wiki/L1371245-S1), [Q81464](https://www.wikidata.org/wiki/Q81464) |  |
| *Brassica oleracea* | cabbage, kale | **col común, berza** | [Q146212](https://www.wikidata.org/wiki/Q146212) | Wikidata has the plural berzas |
| *Eruca vesicaria* | rocket, arugula | **rúcula, roqueta** | [Q5395935](https://www.wikidata.org/wiki/Q5395935) |  |
| *Raphanus sativus* | radish | **rábano** | [L1371347-S1](https://www.wikidata.org/wiki/L1371347-S1), [Q7224565](https://www.wikidata.org/wiki/Q7224565) |  |
| *Beta vulgaris* | beetroot, chard | **acelga** | [Q165191](https://www.wikidata.org/wiki/Q165191) | Only chard: Wikidata has no Spanish name for beetroot (remolacha) here |
| *Citrus × limon* | lemon | **limonero, limón** | [Q500](https://www.wikidata.org/wiki/Q500) |  |
| *Buxus sempervirens* | common box, boxwood | **boj común** | [Q27344](https://www.wikidata.org/wiki/Q27344) |  |
| *Vaccinium corymbosum* | highbush blueberry | **arándano azul** | [Q468695](https://www.wikidata.org/wiki/Q468695) |  |
| *Rubus idaeus* | raspberry | **frambueso, frambuesa** | [Q12252383](https://www.wikidata.org/wiki/Q12252383) |  |
| *Nepeta cataria* | catnip | **hierba gatera, menta gatuna** | [Q161139](https://www.wikidata.org/wiki/Q161139) |  |
| *Tropaeolum majus* | nasturtium | **capuchina, espuela de galán** | [Q156288](https://www.wikidata.org/wiki/Q156288) |  |
| *Helianthus annuus* | sunflower | **girasol** | [Q171497](https://www.wikidata.org/wiki/Q171497) |  |
| *Allium schoenoprasum* | chives | **cebollino** | [Q51148](https://www.wikidata.org/wiki/Q51148) |  |
| *Allium cepa* | onion | **cebolla** | [Q23485](https://www.wikidata.org/wiki/Q23485) |  |
| *Allium sativum* | garlic | **ajo** | [Q23400](https://www.wikidata.org/wiki/Q23400) |  |

## Found on Wikidata, but not proposed

Any of them can be added back, by [decision 2](#2-regional-names) or one by one.

| Taxon | Wikidata has | Why not |
|---|---|---|
| *Colocasia* | Colocasia (Pantheidae) | A moth genus with the same name, not a common name |
| *Agave* | fique | Fique is Furcraea, another genus; agave and maguey are proposed |
| *Euphorbia* | tabaiba | A Canarian name for a few shrubby species, not for the genus |
| *Echinopsis* | quisco | A Chilean name for the columnar species |
| *Phalaenopsis* | orquídea alevilla | Rare; orquídea mariposa, the usual name, isn't on Wikidata |
| *Mentha* | hierbahuerto, pulegio, yerba mota | Names of particular species; menta is on spearmint's item |
| *Lactuca* | Compaßpflanze | German |
| *Paeonia* | Paeoniaceae (label) | The family's name, not a common name; peonía, from the aliases, is proposed |
| *Hyacinthus* | Hyaccolin (label), florinto | Hyaccolin isn't a plant name; jacinto, from the aliases, is proposed |
| *Crocus* | Safran | Not Spanish spelling (azafrán is one species) |
| *Anthurium andraeanum* | Anthurium andreanum (label) | A spelling variant of the scientific name |
| *Colocasia esculenta* | pituca, madumbe, Calla gaby | Very local; taro and malanga, the usual names, aren't on Wikidata |
| *Fittonia albivenis* | Fittonia verschaffeltii (label) | A synonym |
| *Tradescantia zebrina* | Tradescantia pendula (label) | A synonym |
| *Pilea peperomioides* | Pilea (label) | Only the genus's name |
| *Ficus benjamina* | matapalo | Used for many strangler figs; benjamina is proposed |
| *Tillandsia ionantha* | gallito, tenchito | Very local names |
| *Fragaria × ananassa* | Pineberry | An English name of one cultivar |
| *Hydrangea macrophylla* | (Latin synonyms only) | Hortensia is on the genus's item |
| *Rudbeckia hirta* | Rudbeckia bicolor (label) | A synonym |
| *Impatiens walleriana* | China | A local name that reads as the country; alegría de la casa, the usual name, isn't on Wikidata |

## No Spanish name on Wikidata (192)

These keep only their English names (or what decision 1 chooses). Contributions from
a cited source are welcome, as for any other value.

*Monstera*, *Thaumatophyllum*, *Epipremnum*, *Scindapsus*, *Rhaphidophora*, *Syngonium*, *Aglaonema*, *Homalomena*, *Calathea*, *Goeppertia*, *Maranta*, *Ctenanthe*, *Stromanthe*, *Alocasia*, *Fittonia*, *Hypoestes*, *Zamioculcas*, *Sansevieria*, *Aspidistra*, *Chlorophytum*, *Tradescantia*, *Pilea*, *Plectranthus*, *Cissus*, *Peperomia*, *Dischidia*, *Ficus*, *Schefflera*, *Pachira*, *Persea*, *Cordyline*, *Polyscias*, *Fatsia*, *Codiaeum*, *Musa*, *Chamaedorea*, *Howea*, *Dypsis*, *Rhapis*, *Ravenea*, *Nephrolepis*, *Adiantum*, *Asplenium*, *Platycerium*, *Davallia*, *Pteris*, *Phlebodium*, *Streptocarpus*, *Episcia*, *Aeschynanthus*, *Sinningia*, *Columnea*, *Echeveria*, *Crassula*, *Kalanchoe*, *Sempervivum*, *Pachyphytum*, *Graptopetalum*, *Aloe*, *Haworthiopsis*, *Haworthia*, *Gasteria*, *Yucca*, *Beaucarnea*, *Curio*, *Senecio*, *Portulacaria*, *Ceropegia*, *Adenium*, *Mammillaria*, *Gymnocalycium*, *Astrophytum*, *Echinocactus*, *Parodia*, *Cereus*, *Schlumbergera*, *Epiphyllum*, *Rhipsalis*, *Selenicereus*, *Dendrobium*, *Vanda*, *Ludisia*, *Guzmania*, *Vriesea*, *Aechmea*, *Neoregelia*, *Billbergia*, *Cryptanthus*, *Sarracenia*, *Salvia*, *Origanum*, *Laurus*, *Olea*, *Ocimum*, *Petroselinum*, *Coriandrum*, *Anethum*, *Solanum*, *Capsicum*, *Cucumis*, *Cucurbita*, *Phaseolus*, *Pisum*, *Spinacia*, *Brassica*, *Eruca*, *Daucus*, *Raphanus*, *Beta*, *Syringa*, *Vaccinium*, *Rubus*, *Echinacea*, *Rudbeckia*, *Nepeta*, *Achillea*, *Leucanthemum*, *Hosta*, *Heuchera*, *Astilbe*, *Helleborus*, *Dryopteris*, *Polystichum*, *Brunnera*, *Epimedium*, *Petunia*, *Impatiens*, *Lobelia*, *Calibrachoa*, *Tropaeolum*, *Zinnia*, *Cosmos*, *Helianthus*, *Muscari*, *Allium*, *Monstera adansonii*, *Philodendron hederaceum*, *Philodendron erubescens*, *Thaumatophyllum bipinnatifidum*, *Scindapsus pictus*, *Rhaphidophora tetrasperma*, *Syngonium podophyllum*, *Aglaonema commutatum*, *Dieffenbachia seguine*, *Spathiphyllum wallisii*, *Goeppertia orbifolia*, *Goeppertia makoyana*, *Alocasia zebrina*, *Hypoestes phyllostachya*, *Zamioculcas zamiifolia*, *Aspidistra elatior*, *Hoya kerrii*, *Peperomia obtusifolia*, *Peperomia argyreia*, *Ficus lyrata*, *Dracaena marginata*, *Dracaena trifasciata*, *Strelitzia nicolai*, *Cordyline fruticosa*, *Cordyline australis*, *Fatsia japonica*, *Codiaeum variegatum*, *Chamaedorea elegans*, *Howea forsteriana*, *Nephrolepis exaltata*, *Adiantum raddianum*, *Asplenium nidus*, *Platycerium bifurcatum*, *Begonia maculata*, *Begonia rex*, *Streptocarpus ionanthus*, *Echeveria elegans*, *Sedum morganianum*, *Kalanchoe blossfeldiana*, *Haworthiopsis attenuata*, *Haworthiopsis fasciata*, *Beaucarnea recurvata*, *Curio rowleyanus*, *Euphorbia trigona*, *Euphorbia tirucalli*, *Portulacaria afra*, *Adenium obesum*, *Schlumbergera truncata*, *Rhipsalis baccifera*, *Aechmea fasciata*, *Drosera capensis*, *Sarracenia purpurea*, *Daucus carota*, *Citrus japonica*, *Echinacea purpurea*, *Tagetes patula*, *Hyacinthus orientalis*.

Not found on Wikidata by their scientific names: *Schefflera arboricola*, *Mentha × piperita*, *Citrus × sinensis* (hybrids and a synonym, which Wikidata names differently).


## Care profiles

Each profile's English, then the proposed Spanish (in bold).

#### `air_plant`: Air plant → **Planta del aire**

- Tillandsias that need no soil: soak or mist, then let them dry within a few hours.
- **Tillandsias que no necesitan tierra: sumérgelas o pulverízalas, y deja que se sequen en pocas horas.**
- *Notes:* Watering means soaking for 20–30 minutes, then drying upside down. Don't water when it's below 12 °C: they stay wet too long.
- **Regar es sumergirlas de 20 a 30 minutos y dejarlas secar boca abajo. No las riegues por debajo de 12 °C: tardan demasiado en secarse.**

#### `bedding_annual`: Bedding annual → **Anual de temporada**

- Flowers grown for one season in beds, pots and baskets: frequent watering in pots, regular feeding, and removing faded flowers.
- **Flores que se cultivan una temporada en arriates, macetas y cestas colgantes: riego frecuente en maceta, abono regular y quitar las flores marchitas.**

#### `begonia_gesneriad`: Begonias and African violets → **Begonias y violetas africanas**

- Flowering and patterned houseplants: lightly moist soil, bright indirect light, water at the soil rather than on the leaves.
- **Plantas de interior con flores o con hojas vistosas: tierra ligeramente húmeda, luz indirecta brillante, y riega la tierra, no las hojas.**

#### `bog_carnivore`: Bog carnivore → **Carnívora de turbera**

- Carnivorous plants from sunny bogs: always wet with rain or distilled water, full sun or part shade, a cold winter rest, and no fertilizer.
- **Plantas carnívoras de turberas soleadas: siempre húmedas con agua de lluvia o destilada, pleno sol o semisombra, un reposo invernal frío y nada de abono.**
- *Notes:* Use rain, distilled, or reverse-osmosis water; tap water minerals harm them.
- **Usa agua de lluvia, destilada o de ósmosis inversa; los minerales del agua del grifo las dañan.**

#### `bromeliad`: Bromeliad → **Bromelia**

- Tank bromeliads: keep a little water in the central cup, water the soil sparingly, and give bright indirect light.
- **Bromelias de depósito: mantén un poco de agua en la copa central, riega la tierra con moderación y dales luz indirecta brillante.**
- *Notes:* Keep water in the central cup, and empty and refill it every month or two. Never put fertilizer in the cup.
- **Mantén agua en la copa central, y vacíala y vuelve a llenarla cada uno o dos meses. Nunca pongas abono en la copa.**

#### `citrus`: Citrus → **Cítricos**

- Lemons, oranges and kumquats in pots: lots of sun, keep the soil just moist in summer and a little drier in winter, and keep frost-free.
- **Limoneros, naranjos y kumquats en maceta: mucho sol, la tierra apenas húmeda en verano y algo más seca en invierno, y protegidos de las heladas.**

#### `desert_cactus`: Desert cactus → **Cactus de desierto**

- Cacti from deserts and dry grasslands: as much sun as possible, water thoroughly but rarely, and keep almost dry in winter.
- **Cactus de desiertos y praderas secas: todo el sol posible, riegos abundantes pero espaciados, y casi secos en invierno.**

#### `dracaena`: Dracaena → **Dracena**

- Corn plants and dragon trees: bright indirect light, though they cope with less than most indoor trees; let the soil dry a little between waterings, but not right through.
- **Palos de Brasil y dragos: luz indirecta brillante, aunque aguantan menos luz que la mayoría de los árboles de interior; deja que la tierra se seque un poco entre riegos, pero no del todo.**
- *Notes:* Fluoride browns the leaf tips: use a fertilizer low in fluoride and boron, and rinse perlite before potting with it.
- **El flúor quema las puntas de las hojas: usa un abono bajo en flúor y boro, y enjuaga la perlita antes de usarla para plantar.**

#### `easy_foliage`: Easy foliage → **Follaje fácil**

- Fast-growing, adaptable houseplants: water when the top third is dry; they show thirst by drooping and recover quickly.
- **Plantas de interior adaptables y de crecimiento rápido: riega cuando el tercio superior esté seco; muestran la sed decayendo y se recuperan enseguida.**

#### `epiphytic_orchid`: Epiphytic orchid → **Orquídea epífita**

- Orchids that grow on trees, potted in bark: water when the bark is nearly dry and never leave the roots standing in water.
- **Orquídeas que crecen sobre los árboles, plantadas en corteza: riega cuando la corteza esté casi seca y nunca dejes las raíces en agua.**

#### `forest_cactus`: Forest cactus → **Cactus de selva**

- Cacti that grow on trees in rainforests: bright indirect light and more water than desert cacti; many flower after a cool, drier rest.
- **Cactus que crecen sobre los árboles en la selva: luz indirecta brillante y más agua que los cactus de desierto; muchos florecen tras un reposo fresco y más seco.**

#### `fruiting_vegetable`: Fruiting vegetable → **Hortaliza de fruto**

- Warm-season crops grown for their fruit: full sun, steady watering (uneven watering causes split or rotten fruit), and regular feeding once flowering.
- **Cultivos de temporada cálida que se cultivan por su fruto: pleno sol, riego constante (el riego irregular agrieta o pudre los frutos) y abono regular desde la floración.**

#### `humid_tropical_foliage`: Humid tropical foliage → **Follaje tropical de humedad**

- Fussy rainforest-floor plants: evenly moist soil, high humidity, no direct sun.
- **Plantas delicadas del suelo de la selva: tierra uniformemente húmeda, mucha humedad ambiental y nada de sol directo.**

#### `indoor_palm`: Indoor palm → **Palmera de interior**

- Shade-tolerant palms: evenly moist but never soggy soil, bright indirect light.
- **Palmeras que toleran la sombra: tierra uniformemente húmeda pero nunca encharcada, luz indirecta brillante.**

#### `indoor_tree`: Indoor tree → **Árbol de interior**

- Tree-like houseplants: bright light (some direct sun is welcome), water when the top third is dry, and avoid moving them often.
- **Plantas de interior con porte de árbol: luz brillante (algo de sol directo les viene bien), riega cuando el tercio superior esté seco y evita moverlas a menudo.**

#### `leafy_herb`: Leafy herb → **Hierba aromática de hoja**

- Soft, fast-growing herbs: keep the soil lightly moist, plenty of light, and pick often.
- **Hierbas tiernas de crecimiento rápido: mantén la tierra ligeramente húmeda, mucha luz, y cosecha a menudo.**

#### `leafy_vegetable`: Leafy vegetable → **Hortaliza de hoja**

- Cool-season salad and leaf crops: evenly moist soil and some shade in hot weather.
- **Ensaladas y cultivos de hoja de temporada fresca: tierra uniformemente húmeda y algo de sombra cuando hace calor.**

#### `low_light_tough`: Tough low-light foliage → **Follaje resistente de poca luz**

- Very forgiving plants that store water: tolerate low light and long dry spells; overwatering is the main risk.
- **Plantas muy tolerantes que almacenan agua: aguantan poca luz y largas temporadas sin riego; el mayor riesgo es regarlas de más.**
- *Notes:* Cast iron plants (Aspidistra) like a little more water than ZZ and snake plants: water them before the soil dries out completely.
- **La aspidistra necesita algo más de agua que la zamioculca y la lengua de suegra: riégala antes de que la tierra se seque del todo.**

#### `mediterranean_herb`: Mediterranean herbs and shrubs → **Aromáticas y arbustos mediterráneos**

- Sun-loving, drought-tolerant herbs and shrubs: full sun, free-draining soil, water only when mostly dry.
- **Hierbas y arbustos amantes del sol y resistentes a la sequía: pleno sol, tierra con buen drenaje, y riega solo cuando esté casi seca.**

#### `root_vegetable`: Root and bulb vegetable → **Hortaliza de raíz y bulbo**

- Crops grown for roots, tubers, and bulbs: steady moisture while they swell, less as they ripen.
- **Cultivos que se cultivan por sus raíces, tubérculos y bulbos: humedad constante mientras engordan, y menos al madurar.**

#### `rosemary`: Rosemary → **Romero**

- A sun-loving shrub that hates wet roots, but in a pot shouldn't dry out completely: full sun, and a cool, bright spot indoors over winter.
- **Un arbusto amante del sol que odia las raíces mojadas, pero que en maceta no debe secarse del todo: pleno sol, y un sitio fresco y luminoso dentro de casa en invierno.**
- *Notes:* Indoors in winter, dry air and a dried-out pot brown its tips, but extra water rots the roots: keep it cool and bright, and water when the top half is dry.
- **Dentro de casa en invierno, el aire seco y una maceta reseca le queman las puntas, pero el exceso de agua le pudre las raíces: tenlo fresco y con luz, y riega cuando la mitad superior esté seca.**

#### `semi_succulent_epiphyte`: Semi-succulent epiphyte → **Epífita semisuculenta**

- Plants with thick, water-storing leaves that grow on trees in the wild: chunky, airy mix; let the top half dry between waterings.
- **Plantas de hojas gruesas que almacenan agua y crecen sobre los árboles en la naturaleza: una mezcla gruesa y aireada; deja que la mitad superior se seque entre riegos.**

#### `shade_bedding`: Shade bedding annual → **Anual de temporada de sombra**

- Busy Lizzies for shady beds and pots: moist soil, shelter from hot sun, and regular feeding in pots.
- **Alegrías de la casa para arriates y macetas a la sombra: tierra húmeda, protección del sol fuerte y abono regular en maceta.**
- *Notes:* New Guinea impatiens and sun-tolerant hybrids take more sun, and use the bedding annual profile.
- **Las alegrías de Nueva Guinea y los híbridos tolerantes al sol aguantan más sol y usan el perfil de anual de temporada.**

#### `shade_perennial`: Shade perennial → **Vivaz de sombra**

- Perennials for shady gardens: moist, rich soil and protection from midday sun.
- **Vivaces para jardines de sombra: tierra húmeda y rica, y protección del sol del mediodía.**
- *Notes:* Most need no feeding in a border; in poor soil, give a balanced fertilizer in spring.
- **En un arriate, la mayoría no necesita abono; en tierra pobre, dales un abono equilibrado en primavera.**

#### `spring_bulb`: Spring bulb → **Bulbo de primavera**

- Bulbs that flower in spring and rest underground in summer: water while in leaf, then let them dry off after the foliage yellows.
- **Bulbos que florecen en primavera y reposan bajo tierra en verano: riega mientras tengan hojas y deja que se sequen cuando el follaje amarillee.**

#### `succulent`: Succulent → **Suculenta**

- Water-storing plants from dry places: lots of light, gritty soil, and water only when the soil has dried out completely.
- **Plantas que almacenan agua, de lugares secos: mucha luz, tierra arenosa, y riega solo cuando la tierra se haya secado del todo.**

#### `sun_perennial`: Sun-loving perennial → **Vivaz de sol**

- Border perennials that come back every year: full sun or part shade, water in dry spells, and cut back after flowering or in early spring.
- **Vivaces de arriate que vuelven cada año: pleno sol o semisombra, riego en épocas secas, y poda después de la floración o al principio de la primavera.**
- *Notes:* Most need no feeding in a border; in poor soil, give a balanced fertilizer in spring.
- **En un arriate, la mayoría no necesita abono; en tierra pobre, dales un abono equilibrado en primavera.**

#### `temperate_shrub`: Garden shrub → **Arbusto de jardín**

- Hardy shrubs for the garden: water deeply in dry spells, especially while establishing; rain covers most of the year.
- **Arbustos resistentes para el jardín: riego profundo en épocas secas, sobre todo mientras arraigan; la lluvia basta casi todo el año.**

#### `tropical_aroid`: Tropical aroid → **Arácea tropical**

- Climbing and clumping rainforest aroids: bright indirect light, water when the top half of the soil is dry.
- **Aráceas trepadoras y en mata de la selva: luz indirecta brillante, y riega cuando la mitad superior de la tierra esté seca.**

#### `tropical_fern`: Tropical fern → **Helecho tropical**

- Ferns from humid forests: keep the soil lightly moist and the air humid; dry soil quickly browns the fronds.
- **Helechos de bosques húmedos: mantén la tierra ligeramente húmeda y el aire húmedo; la tierra seca enseguida quema las frondas.**

#### `tropical_pitcher_plant`: Tropical pitcher plant → **Planta jarro tropical**

- Nepenthes: warm, humid, bright indirect light, and moist but airy moss-based mix.
- **Nepenthes: calor, humedad, luz indirecta brillante, y una mezcla a base de musgo, húmeda pero aireada.**
- *Notes:* Use rain, distilled, or reverse-osmosis water.
- **Usa agua de lluvia, destilada o de ósmosis inversa.**


### Notes in `genera.yaml`

Each distinct note once; the same Spanish goes everywhere it's used.

| English | Spanish |
|---|---|
| Saponins | Saponinas |
| Insoluble calcium oxalates | Oxalatos de calcio insolubles |
| Calcium oxalate crystals | Cristales de oxalato de calcio |
| Gastrointestinal irritants | Irritantes gastrointestinales |
| Pyrrolizidine alkaloids | Alcaloides de pirrolizidina |
| Insoluble calcium oxalates. ASPCA's entry names the related species Anthurium scherzeranum. | Oxalatos de calcio insolubles. La ficha de la ASPCA nombra la especie emparentada Anthurium scherzeranum. |
| Insoluble calcium oxalates. ASPCA's entry names the related species Aglaonema modestum. | Oxalatos de calcio insolubles. La ficha de la ASPCA nombra la especie emparentada Aglaonema modestum. |
| Insoluble calcium oxalates and a proteolytic enzyme | Oxalatos de calcio insolubles y una enzima proteolítica |
| Calcium oxalate | Oxalato de calcio |
| Now included in Dracaena, but kept separate here: snake plants need much drier care than cane dracaenas. | Ahora incluida en Dracaena, pero aquí se mantiene aparte: las lenguas de suegra necesitan mucho menos riego que las dracenas de caña. |
| Triterpenoid saponins (hederagenin) | Saponinas triterpénicas (hederagenina) |
| Proteolytic enzyme (ficin) and psoralen (ficusin) | Enzima proteolítica (ficina) y psoraleno (ficusina) |
| Mild irritation of the mouth and stomach; the sap can irritate skin | Irritación leve de la boca y el estómago; la savia puede irritar la piel |
| Soluble calcium oxalates | Oxalatos de calcio solubles |
| Bufadienolides | Bufadienólidos |
| Saponins and anthraquinones | Saponinas y antraquinonas |
| Mild irritation of the mouth and stomach; the sap can irritate skin and eyes | Irritación leve de la boca y el estómago; la savia puede irritar la piel y los ojos |
| Irritant milky sap | Savia lechosa irritante |
| Cardiac glycosides | Glucósidos cardíacos |
| Linalool, linalyl acetate | Linalol, acetato de linalilo |
| Eugenol and other essential oils | Eugenol y otros aceites esenciales |
| Furanocoumarins | Furanocumarinas |
| Essential oils | Aceites esenciales |
| Solanine, saponins | Solanina, saponinas |
| Solanine | Solanina |
| Essential oils and psoralens | Aceites esenciales y psoralenos |
| Cyanogenic glycoside | Glucósido cianogénico |
| Alkaloids | Alcaloides |
| Grayanotoxins | Grayanotoxinas |
| Nepetalactone, which can cause vomiting and diarrhoea | Nepetalactona, que puede causar vómitos y diarrea |
| Glycoalkaloids, monoterpenes and sesquiterpene lactones | Glucoalcaloides, monoterpenos y lactonas sesquiterpénicas |
| Toxin unknown; can cause kidney failure in cats | Toxina desconocida; puede causar insuficiencia renal en los gatos |
| Pentacyclic terpenoids | Terpenoides pentacíclicos |
| Paeonol | Peonol |
| Bufadienolides and other glycosides, protoanemonin | Bufadienólidos y otros glucósidos, protoanemonina |
| Geraniol, linalool | Geraniol, linalol |
| Tulipalin A and B | Tulipalinas A y B |
| Lycorine and other alkaloids | Licorina y otros alcaloides |
| Alkaloids, possibly like the daffodil's | Alcaloides, posiblemente como los del narciso |
| N-propyl disulfide | Disulfuro de n-propilo |

## Sources

- Wikidata, the free knowledge base, queried on 2026-11-26 (CC0): the items linked above,
  their *taxon common name* (P1843), Spanish labels and Spanish aliases.
- The app's Spanish glossary, in [translating](translating.md#spanish).
