# Toxicity to pets: November 2026 review

Finishing the toxicity flags in the care dataset, for the 1.2 Lavender release
([roadmap](roadmap.md#lavender-trust-released)). 0.5 Echinacea flagged "the common houseplant
genera first"; the rest was never done, including every outdoor and edible plant added in 0.7
Gardenia. **Approved and applied on 2026-11-20** (dataset 2026.11.6): every addition below,
with the recommended option for each [decision](#decided-2026-11-20).

- **Checked:** 2026-11-20, every genus and species in `genera.yaml` (189 genera, 128 species)
  against the ASPCA's toxic and non-toxic plant lists for cats and for dogs, then each
  matching entry's own page, read one by one.
- **Before:** 29 flags (14 genera, 15 species), all on houseplants.
- **Proposed:** 21 new flags that follow the [existing rules](../data/care/README.md#toxicity-to-pets)
  directly, and 5 decisions below. With the recommendations, that's **30 new flags and one
  moved** (58 in all), and every plant on the ASPCA list that the dataset has is covered,
  except bedding lobelia (decision 1).

## How it was checked

- **Matching:** each scientific name, synonym and common name in the dataset was searched
  for in the ASPCA lists, and every hit was read on its entry page. The lists use some older
  names and misspellings, so these were checked too: tomato is listed as *Lycopersicon*,
  lavender as *Lavendula*, and peony as *Paeonis*.
- **Only "toxic" is recorded,** as before. Where the ASPCA lists a plant as non-toxic, nothing
  is recorded, and the plant stays *unknown*.
- **Genus or species**, following the README: the flag goes on the genus when the entry names
  the whole genus ("*Tulipa* spp.") or the ASPCA lists the genus's common species; otherwise
  on the species.
- **Notes** say what the entry names as the toxic part, in our own words and spelling.
- **The existing 29 flags were checked again.** Every entry still says what the flag says.

## Proposed additions

Each cites the entry's page under
`https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/`.

### On the genus

| Genus | Common name | Cats | Dogs | Entries | Toxic part (note) | Why the genus |
|---|---|---|---|---|---|---|
| *Alocasia* | elephant ear | toxic | toxic | `alocasia` | Insoluble calcium oxalates | "*Alocasia* spp." |
| *Allium* | onion, garlic, chives | toxic | toxic | `onion`, `garlic`, `chives` | N-propyl disulfide | onion, garlic, chives and leek all listed |
| *Buxus* | box | toxic | toxic | `boxwood` | Alkaloids | "*Buxus* spp." |
| *Citrus* | citrus | toxic | toxic | `lemon`, `orange` | Essential oils and psoralens | lemon, orange, lime, grapefruit and others listed |
| *Dracaena* | dragon tree | toxic | toxic | `dracaena` | Saponins | "*Dracaena* spp."; the three species keep their own flags |
| *Helleborus* | hellebore | toxic | toxic | `hellebore` | Bufadienolides and other glycosides, protoanemonin | listed as hellebore, Christmas rose and Lenten rose |
| *Hemerocallis* | daylily | toxic | | `day-lilies-many-varieties` | Unknown | "*Hemerocallis* spp."; **cats only** |
| *Hydrangea* | hydrangea | toxic | toxic | `hydrangea` | Cyanogenic glycoside | listed as hydrangea and hortensia (bigleaf hydrangea) |
| *Ilex* | holly | toxic | toxic | `holly`, `english-holly` | Saponins | American and English holly listed |
| *Iris* | iris | toxic | toxic | `iris` | Pentacyclic terpenoids | "*Iris* species" |
| *Mentha* | mint | toxic | toxic | `mint` | Essential oils | "*Mentha* sp." |
| *Narcissus* | daffodil | toxic | toxic | `daffodil` | Lycorine and other alkaloids | "*Narcissus* spp." |
| *Origanum* | oregano, marjoram | toxic | toxic | `oregano`, `marjoram` | Gastrointestinal irritants | oregano and marjoram listed |
| *Pelargonium* | geranium | toxic | toxic | `geranium` | Geraniol, linalool | "*Pelargonium* species" |
| *Rhododendron* | rhododendron, azalea | toxic | toxic | `rhododendron` | Grayanotoxins | "*Rhododendron* spp." |
| *Senecio* | senecio | toxic | toxic | `ragwort` | Pyrrolizidine alkaloids | "*Senecio* species" |
| *Tulipa* | tulip | toxic | toxic | `tulip` | Tulipalin A and B | "*Tulipa* spp." |

Daylilies are **toxic to cats only**: the ASPCA lists them as non-toxic to dogs, so `dogs` is
left out (unknown), never "safe". The entry names kidney failure among the signs in cats.

### On the species

| Species | Common name | Cats | Dogs | Entry | Toxic part (note) |
|---|---|---|---|---|---|
| *Hyacinthus orientalis* | hyacinth | toxic | toxic | `hyacinth` | Alkaloids, possibly like the daffodil's |
| *Laurus nobilis* | bay laurel | toxic | toxic | `bay-laurel` | Eugenol and other essential oils |
| *Petroselinum crispum* | parsley | toxic | toxic | `parsley` | Furanocoumarins |
| *Solanum lycopersicum* | tomato | toxic | toxic | `tomato-plant` | Solanine (listed under its old name, *Lycopersicon*) |

## Decisions for the maintainer

1. **Entries named for the genus, with one species.** The ASPCA's "Hosta", "Peony",
   "Yarrow", "Lavender" and "Lobelia" entries each give a single species. Options:
   - **A. Flag the genus** for all five. Scope: five genus flags. Risk: a species the ASPCA
     didn't name is called "known to be toxic".
   - **B. Flag only the named species,** where the dataset has it (*Lavandula angustifolia*);
     the other four genera have no species in the dataset, so they stay unknown. Scope: one
     flag. Risk: four common garden plants stay unknown.
   - **C. Per genus:** the genus for *Hosta*, *Paeonia*, *Achillea* and *Lavandula*, where the
     named species is the common one people grow; nothing for *Lobelia*, whose entry is the
     cardinal flower (*L. cardinalis*), not the bedding lobelia (*L. erinus*) the dataset
     means. Scope: four genus flags. Risk: low.
   - **Recommendation: C.**
2. ***Solanum*: genus or tomato only?** Besides tomato, the ASPCA's "Nightshade" entry names
   "*Solanum* spp.". Options:
   - **A. Flag the genus too**, citing `nightshade`, so potato and aubergine are flagged.
     Scope: one more flag. Risk: low; the entry names the genus, and the green parts of both
     contain solanine.
   - **B. Tomato only.** Scope: none. Risk: potato and aubergine stay unknown, though the
     entry covers them.
   - **Recommendation: A.**
3. **Catmint is not catnip.** The ASPCA lists catnip (*Nepeta cataria*) as toxic to cats.
   The dataset's *Nepeta* is catmint, the border perennial (mostly *N.* × *faassenii*), which
   isn't listed. Options:
   - **A. Add *Nepeta cataria* (catnip)** as a species, toxic to cats, with `sun_perennial`
     like its genus. Scope: one species. Risk: low.
   - **B. Flag the genus,** cats only. Scope: one flag. Risk: catmint is called toxic without
     a source for it.
   - **C. Nothing.** Risk: catnip, which many cat owners grow, stays unknown.
   - **Recommendation: A.**
4. ***Cordyline*: the genus flag doesn't fit the rule.** It's on the genus today, from the ti
   plant entry, but the ASPCA lists the red palm lily (*C. rubra*) as **non-toxic**. The README
   says that when species differ, the flag goes on the species, as for *Aloe*. Options:
   - **A. Move it to the species:** add *Cordyline fruticosa* (ti plant, synonym
     *C. terminalis*) and *Cordyline australis* (cabbage tree), each flagged (`ti-plant`,
     `giant-dracaena`), and take it off the genus. Scope: two species. Risk: other
     *Cordyline* become unknown, which is what the rule asks.
   - **B. Keep the genus flag.** Scope: none. Risk: it calls *C. rubra* toxic against the
     source.
   - **Recommendation: A.**
5. ***Euphorbia*: the ASPCA lists poinsettia and pencil cactus, not the dataset's species.**
   The dataset has crown of thorns (*E. milii*) and African milk tree (*E. trigona*). Options:
   - **A. Add pencil cactus (*Euphorbia tirucalli*)** as a species, flagged, with
     `succulent` like its genus. Poinsettia needs a care profile of its own, which would need
     its own check against sources, so it's noted for later. Scope: one species. Risk: low.
   - **B. Flag the genus.** Risk: crown of thorns and African milk tree are called toxic
     without a source for them.
   - **C. Nothing.** Risk: none, but pencil cactus stays unknown.
   - **Recommendation: A.**

### Decided (2026-11-20)

1. **C:** *Hosta*, *Paeonia*, *Achillea* and *Lavandula* are flagged on the genus; *Lobelia*
   stays unknown.
2. **A:** *Solanum* is flagged on the genus (`nightshade`), and tomato keeps its own entry.
3. **A:** catnip (*Nepeta cataria*) is a species, toxic to cats.
4. **A:** *Cordyline fruticosa* (ti plant) and *Cordyline australis* (cabbage tree) are
   species with their own flags; the genus has none.
5. **A:** pencil cactus (*Euphorbia tirucalli*) is a species, flagged. Poinsettia is noted for
   later.

The citation links were updated to the ASPCA's new address too.

## Also proposed

- **Update the citation links.** The ASPCA moved its plant pages from
  `/pet-care/animal-poison-control/` to `/pet-care/aspca-poison-control/`. The old links still
  redirect, but 22 of the 29 citations use them. Change them to the new address. Scope:
  links only. Risk: none.

## Addendum: a second source (decided 2026-11-20)

Some popular houseplants aren't in the ASPCA's list at all, so they stayed unknown. Two more
sources were checked for them, on 2026-11-20:

- **The [NC State Extension Plant Toolbox](https://plants.ces.ncsu.edu/).** Its "Poison"
  fields (severity, symptoms, toxic part) are about **people**. It mentions pets only in some
  plants' descriptions, and in tags such as "problem for cats" and "problem for dogs".
- **[Pet Poison Helpline](https://www.petpoisonhelpline.com/).** Its pages say "toxic to
  pets", without naming cats or dogs, and it has no page for most of these plants.

| Plant | NC State | Pet Poison Helpline |
|---|---|---|
| ZZ plant | "medium toxicity to cats and dogs" | no page |
| *Monstera adansonii* | "toxic to humans and pets"; tagged for cats and dogs | no page |
| String of pearls (*Curio rowleyanus*) | "toxic to both humans and pets"; tagged for cats and dogs | no page found |
| Croton (*Codiaeum variegatum*) | about people only | toxic to pets: mild mouth and stomach irritation |
| Crown of thorns (*Euphorbia milii*) | tagged for cats and dogs, no text | toxic to pets: mild irritation, sap irritates skin and eyes |
| *Rhaphidophora*, *Homalomena*, *Agave*, avocado | about people only, tags only, or nothing | no page, or not readable |

Options:

- **A. NC State, only where its text names pets:** ZZ plant, *M. adansonii*, string of pearls.
  Risk: low.
- **B. A, and Pet Poison Helpline:** also croton and crown of thorns. Risk: low to medium, as
  "pets" is recorded as cats and dogs.
- **C. The ASPCA only.** Risk: these stay unknown.

**Decided: B** (dataset 2026.11.7). The README's rule now says: the ASPCA first; only where it has no entry, NC
State or Pet Poison Helpline, when the page says the plant is toxic to pets, cats or dogs;
"pets" is recorded as cats and dogs unless one is named. A page about people only isn't
enough. Five species are flagged:

| Species | Common name | Source | Toxic part (note) |
|---|---|---|---|
| *Zamioculcas zamiifolia* | ZZ plant | NC State | Calcium oxalate |
| *Monstera adansonii* | Swiss cheese vine | NC State | Calcium oxalate crystals |
| *Curio rowleyanus* | string of pearls | NC State | Pyrrolizidine alkaloids |
| *Codiaeum variegatum* | croton | Pet Poison Helpline | Mild irritation of the mouth and stomach; the sap can irritate skin |
| *Euphorbia milii* | crown of thorns | Pet Poison Helpline | Mild irritation of the mouth and stomach; the sap can irritate skin and eyes |

That makes **63 flags** in all.

## Noted for later

- **Still unknown:** *Rhaphidophora* (NC State tags it as a problem for cats and dogs, but
  says nothing about pets in its text), *Homalomena*, *Agave* and avocado (the ASPCA covers
  avocado under foods to avoid, not in its plant list). Each needs a page that says it's
  toxic to pets.
- **Poinsettia** (*Euphorbia pulcherrima*), when a care profile for it has been checked
  against sources.
- **Toxicity to people** is planned for [1.3 Monstera](roadmap.md#monstera-simple-by-default-planned),
  with its own sources.

## Sources

- ASPCA Animal Poison Control, *Toxic and Non-Toxic Plant List — Cats* and *— Dogs*,
  <https://www.aspca.org/pet-care/animal-poison-control/cats-plant-list> and
  <https://www.aspca.org/pet-care/animal-poison-control/dogs-plant-list>, read 2026-11-20.
- The ASPCA's entry page for each plant above, under
  <https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/>, read
  2026-11-20. The facts are used and cited; the lists themselves aren't copied.
