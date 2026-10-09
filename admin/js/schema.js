/* ==========================================================================
   schema.js — what is editable, what it is called, and where it shows up.

   One entry per field. `path` is a dot path into the document's JSON; `cms`
   is the data-cms key the build stamps onto the element that renders it,
   which is what lets the preview patch a draft into a real page.

   Labels are Serbian because the website is. Anything not listed here is not
   editable by design — products come from the shop's catalogue, and layout
   belongs in the code.
   ========================================================================== */

/** Image placements, with the proportions the design expects. */
export const IMAGE_SLOTS = {
  logo: {
    label: 'Logo (znak)',
    help: 'Kvadratna slika sa providnom pozadinom. Ide u zaglavlje i na sredinu ploče.',
    ratio: '1 : 1',
    recommended: '1000 × 1000 px, PNG sa providnom pozadinom',
  },
  wordmark: {
    label: 'Natpis na početnoj',
    help: 'Nacrtani natpis preko hero sekcije. Providna pozadina.',
    ratio: '≈ 1.2 : 1',
    recommended: '1200 × 1000 px, PNG sa providnom pozadinom',
  },
};

export const PRODUCT_IMAGE_HINT = {
  ratio: '1 : 1',
  recommended: '1000 × 1000 px, JPG ili WebP — omot ploče',
};

const T = (path, label, extra = {}) => ({ path, label, type: 'text', ...extra });
const A = (path, label, extra = {}) => ({ path, label, type: 'textarea', ...extra });
const U = (path, label, extra = {}) => ({ path, label, type: 'url', ...extra });

/* Pages document — every field's cms key is simply its path. */
const pageField = (f) => ({ ...f, cms: f.cms ?? f.path });

export const GROUPS = [
  /* ------------------------------------------------------------- početna */
  {
    id: 'pocetna',
    nav: 'Početna',
    group: 'Stranice',
    doc: 'pages',
    title: 'Početna strana',
    intro: 'Tekstovi na naslovnoj. Brojevi (koliko naslova, koliko na stanju) računaju se iz kataloga i ne unose se ručno.',
    previewPath: '/',
    sections: [
      {
        title: 'Hero',
        fields: [
          T('home.heroLedeSuffix', 'Rečenica ispod naslova',
            { help: 'Dodaje se na slogan radnje, koji se menja u „Podaci radnje”.' }),
          T('home.heroPrimaryLabel', 'Glavno dugme — tekst'),
          U('home.heroPrimaryHref', 'Glavno dugme — link'),
          T('home.heroSecondaryLabel', 'Drugo dugme — tekst'),
          U('home.heroSecondaryHref', 'Drugo dugme — link'),
          T('home.heroScrollHint', 'Natpis uz strelicu za skrol'),
        ],
      },
      {
        title: 'Odeljenja',
        fields: [
          T('home.departmentsEyebrow', 'Nadnaslov'),
          T('home.departmentsTitle', 'Naslov'),
        ],
      },
      {
        title: 'Novo u ponudi',
        fields: [
          T('home.newInEyebrow', 'Nadnaslov'),
          T('home.newInTitle', 'Naslov'),
          T('home.newInLinkLabel', 'Link — tekst'),
          U('home.newInLinkHref', 'Link — adresa'),
        ],
      },
      {
        title: 'Izbor radnje',
        fields: [
          T('home.selectedEyebrow', 'Nadnaslov'),
          T('home.selectedTitle', 'Naslov'),
        ],
      },
      {
        title: 'Rasprodaja na početnoj',
        fields: [
          T('home.saleEyebrow', 'Nadnaslov'),
          T('home.saleTitle', 'Naslov', { help: 'Broj sniženih naslova se dopisuje automatski.' }),
          T('home.saleLinkLabel', 'Link — tekst'),
          U('home.saleLinkHref', 'Link — adresa'),
        ],
      },
      {
        title: 'Radnja',
        fields: [
          T('home.storeEyebrow', 'Nadnaslov'),
          T('home.storeTitle', 'Naslov'),
          A('home.storeBody', 'Tekst'),
          T('home.storeCtaLabel', 'Dugme — tekst'),
          U('home.storeCtaHref', 'Dugme — link'),
        ],
      },
      {
        title: 'Tattoo studio',
        fields: [
          T('home.tattooEyebrow', 'Nadnaslov',
            { help: 'Ime i opis studija se menjaju u „Podaci radnje”.' }),
        ],
      },
    ],
  },

  /* -------------------------------------------------------------- katalog */
  {
    id: 'katalog',
    nav: 'Katalog',
    group: 'Stranice',
    doc: 'pages',
    title: 'Katalog i odeljenja',
    intro: 'Zaglavlje stranice „Proizvodi” i tekst koji se vidi kada je neko odeljenje prazno.',
    previewPath: '/proizvodi/',
    sections: [
      {
        title: 'Stranica Proizvodi',
        fields: [
          T('catalog.title', 'Naslov'),
          T('catalog.ledePrefix', 'Uvod — pre broja naslova'),
          T('catalog.ledeSuffix', 'Uvod — posle broja naslova'),
        ],
      },
      {
        title: 'Prazno odeljenje',
        fields: [
          A('category.emptyHintBody', 'Objašnjenje'),
          T('category.emptyHintCtaLabel', 'Dugme — tekst'),
          U('category.emptyHintCtaHref', 'Dugme — link'),
        ],
      },
    ],
  },

  /* ----------------------------------------------------------- rasprodaja */
  {
    id: 'rasprodaja',
    nav: 'Rasprodaja',
    group: 'Stranice',
    doc: 'pages',
    title: 'Rasprodaja',
    intro: 'Cene na sniženju dolaze iz kataloga radnje i ne unose se ovde.',
    previewPath: '/rasprodaja/',
    sections: [
      {
        title: 'Zaglavlje',
        fields: [
          T('sale.titleLine1', 'Naslov — prvi red'),
          T('sale.titleLine2', 'Naslov — drugi red'),
          A('sale.lede', 'Uvodni tekst'),
          { path: 'sale.marquee', label: 'Reči u pokretnoj traci', type: 'list',
            help: 'Jedna reč po redu.' },
        ],
      },
      {
        title: 'Kada nema sniženja',
        fields: [
          T('sale.emptyTitle', 'Naslov'),
          A('sale.emptyBody', 'Tekst'),
          T('sale.emptyPrimaryLabel', 'Prvo dugme — tekst'),
          U('sale.emptyPrimaryHref', 'Prvo dugme — link'),
          T('sale.emptySecondaryLabel', 'Drugo dugme — tekst'),
          U('sale.emptySecondaryHref', 'Drugo dugme — link'),
        ],
      },
    ],
  },

  /* -------------------------------------------------------------- kontakt */
  {
    id: 'kontakt',
    nav: 'Kontakt',
    group: 'Stranice',
    doc: 'pages',
    title: 'Kontakt stranica',
    intro: 'Adresa, telefon i radno vreme se menjaju u „Podaci radnje” i ovde se samo prikazuju.',
    previewPath: '/kontakt/',
    sections: [
      {
        title: 'Zaglavlje',
        fields: [
          T('contact.titleLine1', 'Naslov — prvi red'),
          T('contact.titleLine2', 'Naslov — drugi red'),
          A('contact.lede', 'Uvodni tekst'),
        ],
      },
      {
        title: 'Mapa',
        fields: [
          T('contact.mapEyebrow', 'Nadnaslov'),
          U('contact.mapEmbedUrl', 'Adresa ugrađene mape',
            { help: 'Google Maps → Deli → Ugradi mapu → kopirajte samo adresu iz src="…".' }),
          T('contact.mapLinkLabel', 'Link ispod mape — tekst'),
        ],
      },
      {
        title: 'Poručivanje i dostava',
        fields: [
          T('contact.deliveryEyebrow', 'Nadnaslov'),
          T('contact.deliveryTitle', 'Naslov'),
          A('contact.deliveryBodyBefore', 'Tekst pre linka'),
          T('contact.deliveryLinkLabel', 'Link — tekst'),
          T('contact.deliveryBodyAfter', 'Tekst posle linka',
            { help: 'Počinje zarezom ako nastavlja istu rečenicu.' }),
          A('contact.deliveryNote', 'Napomena ispod'),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- korpa/kasa */
  {
    id: 'korpa',
    nav: 'Korpa i kasa',
    group: 'Stranice',
    doc: 'pages',
    title: 'Korpa i kasa',
    intro: 'Online plaćanje karticom nije uključeno na sajtu. Narudžbenica se šalje radnji — tekstovi ispod to objašnjavaju kupcu.',
    previewPath: '/korpa/',
    sections: [
      {
        title: 'Korpa',
        fields: [T('cart.title', 'Naslov'), A('cart.lede', 'Uvodni tekst')],
      },
      {
        title: 'Kasa',
        fields: [
          T('checkout.title', 'Naslov'),
          A('checkout.lede', 'Uvodni tekst'),
          T('checkout.emptyTitle', 'Prazna korpa — naslov'),
          A('checkout.emptyBody', 'Prazna korpa — tekst'),
          T('checkout.emptyCtaLabel', 'Prazna korpa — dugme'),
          U('checkout.emptyCtaHref', 'Prazna korpa — link'),
          A('checkout.paymentNote', 'Napomena o plaćanju'),
          T('checkout.submitLabel', 'Dugme za potvrdu'),
          T('checkout.backLabel', 'Dugme za povratak'),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------- 404 */
  {
    id: 'nenadjeno',
    nav: 'Strana 404',
    group: 'Stranice',
    doc: 'pages',
    title: 'Strana nije nađena',
    intro: 'Ono što posetilac vidi kada otvori link koji ne postoji.',
    previewPath: '/404.html',
    sections: [
      {
        title: 'Tekst',
        fields: [
          A('notFound.body', 'Objašnjenje'),
          T('notFound.primaryLabel', 'Prvo dugme — tekst'),
          U('notFound.primaryHref', 'Prvo dugme — link'),
          T('notFound.secondaryLabel', 'Drugo dugme — tekst'),
          U('notFound.secondaryHref', 'Drugo dugme — link'),
        ],
      },
    ],
  },

  /* ----------------------------------------------------------- odeljenja */
  {
    id: 'odeljenja',
    nav: 'Odeljenja',
    group: 'Sadržaj',
    doc: 'categories',
    title: 'Odeljenja prodavnice',
    intro: 'Pet odeljenja koja se vide na početnoj, u meniju i u traci iznad kataloga. Broj naslova se računa automatski.',
    previewPath: '/',
    root: true,
    sections: [
      {
        title: 'Odeljenja',
        fields: [
          {
            path: '', label: 'Odeljenja', type: 'items',
            addLabel: 'Dodaj odeljenje',
            titleFrom: 'label',
            help: 'Redosled ovde je redosled na sajtu. Brisanje odeljenja uklanja i njegovu stranicu.',
            item: {
              fields: [
                T('label', 'Naziv', { cms: (it) => `categories.${it.slug}.label` }),
                A('blurb', 'Opis', { cms: (it) => `categories.${it.slug}.blurb` }),
                T('emptyState', 'Tekst kada je prazno'),
                T('code', 'Oznaka', { help: 'Kratka oznaka na ploči, npr. LP ili CD.' }),
                T('rpm', 'Natpis u traci', { help: 'Npr. VINYL / LP.' }),
                T('slug', 'Adresa (slug)',
                  { help: 'Menja adresu stranice. Stari linkovi prestaju da rade.' }),
                T('href', 'Putanja', { help: 'Mora odgovarati slug-u, npr. /ploce/.' }),
              ],
            },
          },
        ],
      },
    ],
  },

  /* --------------------------------------------------------------- radnja */
  {
    id: 'radnja',
    nav: 'Podaci radnje',
    group: 'Sadržaj',
    doc: 'site',
    title: 'Podaci radnje',
    intro: 'Adresa, telefon, e-mail i radno vreme. Ovi podaci se pojavljuju na početnoj, u podnožju, na kontaktu i u podacima za pretraživače.',
    previewPath: '/kontakt/',
    sections: [
      {
        title: 'Brend',
        fields: [
          T('brand.name', 'Naziv', { cms: 'site.brand.name' }),
          A('brand.tagline', 'Slogan', { cms: 'site.brand.tagline' }),
          A('brand.description', 'Opis za pretraživače',
            { help: 'Koristi se kao opis početne strane ako SEO opis nije unet.' }),
          T('brand.city', 'Grad (velikim slovima)'),
          T('brand.country', 'Država'),
          T('brand.legalEntity', 'Pravno lice'),
          T('brand.copyright', 'Copyright u podnožju'),
          T('brand.poweredBy.label', 'Izrada sajta — naziv'),
          U('brand.poweredBy.url', 'Izrada sajta — link'),
        ],
      },
      {
        title: 'Kontakt',
        fields: [
          T('store.street', 'Ulica i broj', { cms: 'site.store.street' }),
          T('store.city', 'Grad'),
          T('store.address', 'Puna adresa', { help: 'Koristi se u podacima za pretraživače i u linku ka mapama.' }),
          { path: 'store.phone', label: 'Telefon', type: 'tel' },
          T('store.phoneHref', 'Telefon za pozivanje', { help: 'Bez razmaka, npr. +381659966623.' }),
          { path: 'store.email', label: 'E-mail', type: 'email' },
        ],
      },
      {
        title: 'Radno vreme',
        fields: [
          {
            path: 'store.hours', label: 'Radno vreme', type: 'items',
            addLabel: 'Dodaj dan', titleFrom: 'day', reorder: true,
            item: { fields: [T('day', 'Dan'), T('time', 'Vreme', { help: 'Upišite „Zatvoreno” za neradni dan.' })] },
          },
        ],
      },
      {
        title: 'Tattoo studio',
        fields: [
          T('tattoo.name', 'Naziv', { cms: 'site.tattoo.name' }),
          A('tattoo.note', 'Opis', { cms: 'site.tattoo.note' }),
          { path: 'tattoo.phone', label: 'Telefon', type: 'tel' },
          T('tattoo.phoneHref', 'Telefon za pozivanje'),
          { path: 'tattoo.email', label: 'E-mail', type: 'email' },
        ],
      },
      {
        title: 'Društvene mreže',
        fields: [
          {
            path: 'social', label: 'Linkovi', type: 'items',
            addLabel: 'Dodaj mrežu', titleFrom: 'label', reorder: true,
            item: { fields: [T('label', 'Naziv'), U('url', 'Adresa')] },
          },
        ],
      },
      {
        title: 'Slike sajta',
        fields: [
          { path: 'images.logo', label: IMAGE_SLOTS.logo.label, type: 'image', slot: 'logo' },
          { path: 'images.wordmark', label: IMAGE_SLOTS.wordmark.label, type: 'image', slot: 'wordmark' },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- navigacija */
  {
    id: 'navigacija',
    nav: 'Meni',
    group: 'Sadržaj',
    doc: 'site',
    title: 'Meni i podnožje',
    intro: 'Stavke glavnog menija i dodatnih linkova u podnožju.',
    previewPath: '/',
    sections: [
      {
        title: 'Glavni meni',
        fields: [
          {
            path: 'nav', label: 'Stavke', type: 'items',
            addLabel: 'Dodaj stavku', titleFrom: 'label', reorder: true,
            item: { fields: [T('label', 'Tekst'), U('href', 'Link')] },
          },
        ],
      },
      {
        title: 'Dodatni linkovi',
        fields: [
          {
            path: 'secondaryNav', label: 'Stavke', type: 'items',
            addLabel: 'Dodaj stavku', titleFrom: 'label', reorder: true,
            item: { fields: [T('label', 'Tekst'), U('href', 'Link')] },
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------- dostava */
  {
    id: 'dostava',
    nav: 'Dostava',
    group: 'Sadržaj',
    doc: 'site',
    title: 'Dostava i plaćanje',
    intro: 'Zone i cene dostave koje kupac bira na kasi.',
    previewPath: '/checkout/',
    sections: [
      {
        title: 'Način plaćanja',
        fields: [
          T('checkout.paymentMethod.label', 'Naziv'),
          A('checkout.paymentMethod.note', 'Objašnjenje'),
          U('checkout.priceListUrl', 'Link ka cenovniku'),
        ],
      },
      {
        title: 'Zone dostave',
        fields: [
          {
            path: 'checkout.zones', label: 'Zone', type: 'items',
            addLabel: 'Dodaj zonu', titleFrom: 'label', reorder: true,
            item: {
              fields: [
                T('label', 'Naziv zone'),
                { path: 'cost', label: 'Cena', type: 'number',
                  help: 'Ostavite prazno kada se cena računa po cenovniku.' },
                A('note', 'Napomena'),
              ],
            },
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------- privatnost */
  {
    id: 'privatnost',
    nav: 'Politika privatnosti',
    group: 'Sadržaj',
    doc: 'privacy',
    title: 'Politika privatnosti',
    intro: 'Pravni tekst. Menjajte ga samo kada se stvarno promeni način obrade podataka.',
    previewPath: '/politika-privatnosti/',
    sections: [
      {
        title: 'Zaglavlje stranice',
        doc: 'pages',
        fields: [
          T('privacy.titleLine1', 'Naslov — prvi red', { cms: 'privacy.titleLine1' }),
          T('privacy.titleLine2', 'Naslov — drugi red', { cms: 'privacy.titleLine2' }),
        ],
      },
      {
        title: 'Dokument',
        fields: [
          T('title', 'Naslov dokumenta'),
          {
            path: 'sections', label: 'Odeljci', type: 'items',
            addLabel: 'Dodaj odeljak', titleFrom: 'heading', reorder: true,
            emptyTitle: '(bez naslova)',
            item: {
              fields: [
                T('heading', 'Naslov odeljka'),
                {
                  path: 'blocks', label: 'Pasusi', type: 'items',
                  addLabel: 'Dodaj pasus', titleFrom: 'text', reorder: true,
                  item: {
                    fields: [
                      { path: 'type', label: 'Vrsta', type: 'select',
                        options: [['p', 'Pasus'], ['li', 'Stavka liste'], ['h3', 'Podnaslov']] },
                      A('text', 'Tekst'),
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ SEO */
  {
    id: 'seo',
    nav: 'SEO',
    group: 'Sadržaj',
    doc: 'pages',
    title: 'Naslovi i opisi za pretraživače',
    intro: 'Naslov strane (oko 60 znakova) i opis (oko 155) pojavljuju se u rezultatima pretrage i kada se link deli na mrežama.',
    previewPath: '/',
    sections: [
      {
        title: 'Početna',
        fields: [
          T('home.seoTitle', 'Naslov', { max: 65 }),
          A('home.seoDescription', 'Opis', { max: 160, help: 'Prazno = koristi se opis brenda.' }),
        ],
      },
      {
        title: 'Proizvodi',
        fields: [
          T('catalog.seoTitle', 'Naslov', { max: 65 }),
          T('catalog.seoDescriptionPrefix', 'Opis — pre broja naslova'),
          T('catalog.seoDescriptionSuffix', 'Opis — posle broja naslova'),
        ],
      },
      {
        title: 'Rasprodaja',
        fields: [T('sale.seoTitle', 'Naslov', { max: 65 }), A('sale.seoDescription', 'Opis', { max: 160 })],
      },
      {
        title: 'Kontakt',
        fields: [
          T('contact.seoTitle', 'Naslov', { max: 65 }),
          A('contact.seoDescription', 'Opis', { max: 160, help: 'Prazno = sastavlja se od adrese i telefona.' }),
        ],
      },
      {
        title: 'Korpa',
        fields: [T('cart.seoTitle', 'Naslov', { max: 65 }), A('cart.seoDescription', 'Opis', { max: 160 })],
      },
      {
        title: 'Kasa',
        fields: [T('checkout.seoTitle', 'Naslov', { max: 65 }), A('checkout.seoDescription', 'Opis', { max: 160 })],
      },
      {
        title: 'Politika privatnosti',
        fields: [T('privacy.seoTitle', 'Naslov', { max: 65 }), A('privacy.seoDescription', 'Opis', { max: 160 })],
      },
      {
        title: 'Strana 404',
        fields: [T('notFound.seoTitle', 'Naslov', { max: 65 }), A('notFound.seoDescription', 'Opis', { max: 160 })],
      },
    ],
  },
];

/* Decorate page fields with their implicit cms key. */
for (const g of GROUPS) {
  for (const s of g.sections) {
    for (const f of s.fields) {
      if (g.doc === 'pages' && !f.cms && f.type !== 'items') pageField(f);
      if (g.doc !== 'pages' && !f.cms && f.type !== 'items' && f.type !== 'image') {
        f.cms = `${g.doc}.${f.path}`;
      }
    }
  }
}

export const DOC_LABELS = {
  site: 'Podaci radnje',
  categories: 'Odeljenja',
  pages: 'Tekstovi stranica',
  privacy: 'Politika privatnosti',
};

export const groupById = (id) => GROUPS.find((g) => g.id === id);
