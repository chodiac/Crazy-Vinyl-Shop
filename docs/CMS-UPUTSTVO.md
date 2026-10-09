# Uputstvo za uređivanje sajta

Sajt se menja preko admin panela na adresi **crazyvinylshop.rs/admin/**.
Nije potrebno dirati kod.

---

## Prijava

Otvorite `/admin/`, upišite e-mail i lozinku. Ako ste zaboravili lozinku,
kliknite **Zaboravljena lozinka?** — stiže vam link na mejl.

---

## Kako radi: nacrt → pregled → objava

Ovo su tri dugmeta gore desno i uvek idu tim redom.

**Sačuvaj nacrt**
Čuva ono što ste upisali. Nacrt vidite samo vi. Posetioci i dalje vide staru
verziju. Nacrt ostaje sačuvan i kad zatvorite prozor ili se odjavite.

**Pregled**
Otvara pravu stranicu sajta sa vašim izmenama — isti raspored, isti fontovi,
isto na telefonu. Gore stoji narandžasta traka *PREGLED NACRTA* da se ne
pomeša sa pravim sajtom. U traci možete birati stranicu i širinu ekrana
(Telefon / Tablet / Desktop).

**Objavi**
Tek ovo menja ono što posetioci vide. Panel vam prvo pokaže spisak onoga što
se objavljuje i traži potvrdu. Sajt se iznova gradi u pozadini — izmene su na
sajtu za **minut do dva**. Osvežite stranicu ako ih ne vidite odmah.

> Narandžasta tačka pored stavke u levom meniju znači: tu ima nešto što još
> nije objavljeno.

---

## Šta se gde menja

Levi meni je podeljen po stranicama sajta.

### Stranice
* **Početna** — svi naslovi, uvodni tekstovi i dugmad na naslovnoj strani.
* **Katalog** — zaglavlje stranice *Proizvodi* i tekst kad je odeljenje prazno.
* **Rasprodaja** — naslov, uvod, reči u pokretnoj traci, i tekst kad nema
  sniženja.
* **Kontakt** — naslov, uvod, mapa i tekst o dostavi.
* **Korpa i kasa** — tekstovi oko poručivanja.
* **Strana 404** — šta se vidi kad link ne postoji.

### Sadržaj
* **Odeljenja** — pet odeljenja prodavnice (Ploče, Diskovi, Majice, Šolje,
  Ostalo). Naziv, opis, redosled.
* **Podaci radnje** — adresa, telefon, e-mail, radno vreme, društvene mreže,
  tattoo studio, logo. Ovi podaci se pojavljuju na više mesta odjednom:
  promenite ih jednom i menjaju se svuda.
* **Meni** — stavke glavnog menija i linkova u podnožju.
* **Dostava** — zone i cene dostave koje kupac bira na kasi.
* **Politika privatnosti** — pravni tekst.
* **SEO** — naslov i opis svake stranice za Google.

### Slike
* **Biblioteka slika** — sve otpremljene slike.
* **Omoti proizvoda** — slika omota za svaki naslov iz kataloga.

---

## Spiskovi: dodavanje, redosled, skrivanje

Radno vreme, društvene mreže, meni, odeljenja i zone dostave su spiskovi.
Pored svake stavke stoje četiri dugmeta:

| | |
| --- | --- |
| ↑ ↓ | pomeranje gore/dole — taj redosled se vidi na sajtu |
| oko | **sakrij / prikaži** — skrivena stavka ostaje kod vas, ali nestaje sa sajta |
| kanta | brisanje — traži potvrdu |

Skrivanje je sigurnije od brisanja kad nešto privremeno ne treba.

---

## Slike

### Otpremanje
U **Biblioteci slika** prevucite slike u polje ili kliknite da ih izaberete.
Dozvoljeni su JPG, PNG, WebP, AVIF i SVG, do 10 MB po slici.

### Alternativni tekst
Kliknite na sliku pa upišite **alternativni tekst** — kratak opis onoga što se
na slici vidi. To čitaju ljudi koji ne vide sliku i pretraživači.

### Preporučene veličine

| Mesto | Odnos | Preporuka |
| --- | --- | --- |
| Logo (znak) | 1 : 1 | 1000 × 1000 px, PNG sa providnom pozadinom |
| Natpis na početnoj | ≈ 1.2 : 1 | 1200 × 1000 px, PNG sa providnom pozadinom |
| Omot proizvoda | 1 : 1 | 1000 × 1000 px, JPG ili WebP |

Slika se uklapa u postojeći raspored — ne menja izgled sajta.

### Brisanje
Slika koja se negde koristi **ne može** da se obriše. Panel kaže gde se
koristi; prvo je tamo zamenite, pa je onda obrišite.

---

## Omoti proizvoda

Katalog ima oko 1.470 naslova i svaki čeka sliku omota. Dok je nema, na sajtu
stoji prazno mesto sa imenom izvođača.

1. Otvorite **Omoti proizvoda**.
2. Čekirajte **Prikaži samo naslove bez slike** da vidite šta fali.
3. Nađite naslov kroz pretragu.
4. **Dodaj sliku** → otpremite ili izaberite iz biblioteke.
5. Kad završite grupu naslova, kliknite **Objavi**.

> Izvođač, naslov, cena i stanje dolaze iz kataloga radnje i ne menjaju se u
> panelu — da ne bi postojale dve različite verzije istog podatka.

---

## Vraćanje stare verzije

**Istorija i vraćanje** čuva svaku prethodnu objavu.

1. Nađite verziju po datumu.
2. **Vrati u nacrt** — stara verzija se učitava kao nacrt.
3. **Pregled** da proverite.
4. **Objavi**.

Vraćanje ne menja sajt odmah. Sajt se menja tek kad objavite, isto kao i svaka
druga izmena.

---

## Sitnice koje vredi znati

* **Brojevi se računaju sami.** „1470 naslova”, „351 na stanju”, broj sniženih
  — to dolazi iz kataloga i ne kuca se ručno.
* **Linkovi.** U polja za link upisujte ili punu adresu (`https://…`) ili
  putanju unutar sajta (`/kontakt/`). Panel upozorava ako nešto nije u redu.
* **SEO naslov** ide do oko 60 znakova, **opis** do oko 155. Panel broji i
  javlja kad je predugačko.
* **Nesačuvane izmene.** Ako pokušate da zatvorite prozor sa nesačuvanim
  izmenama, pregledač pita da li ste sigurni. Dugme **Odbaci nesačuvano**
  vraća odeljak na poslednji sačuvan nacrt.
* **Panel radi i na telefonu.**

---

## Ako nešto ne radi

**Izmene se ne vide na sajtu posle objave**
Sačekajte dva minuta pa osvežite stranicu sa `Ctrl + F5`.

**Panel kaže „izgradnja sajta nije pokrenuta automatski”**
Sadržaj je sačuvan i objavljen u bazi, samo sajt nije prepravljen. Javite
osobi koja održava sajt — pokreće se jednim klikom na GitHub-u.

**„Nemate pristup” posle prijave**
Taj nalog nije administrator. Vidi `docs/CMS-SETUP.md`.
