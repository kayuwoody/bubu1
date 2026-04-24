import type { MenuData } from './types';

const MENU_DATA: MenuData = {
  categories: [
    { id: 'popular',   label: 'Popular' },
    { id: 'coffee',    label: 'Coffee' },
    { id: 'noncoffee', label: 'Non-Coffee' },
    { id: 'cold',      label: 'Iced & Frappe' },
    { id: 'pastry',    label: 'Bakes' },
    { id: 'combo',     label: 'Combos' },
  ],
  items: [
    { id: 'flat',   cat: 'popular',   name: 'Flat White',         desc: 'Double shot, velvet milk',     price: 10.50, tag: '★ Top seller', swatch: '#C88A54' },
    { id: 'latte',  cat: 'popular',   name: 'Oasis Latte',        desc: 'House blend, steamed milk',    price: 11.00, tag: null,           swatch: '#D9A977' },
    { id: 'kopi',   cat: 'popular',   name: 'Kopi-O Gula Melaka', desc: 'Local twist, palm sugar',      price:  8.50, tag: 'Local fav',    swatch: '#4A2A14' },
    { id: 'danish', cat: 'popular',   name: 'Butter Danish',      desc: 'Flaky, warmed to order',       price:  6.50, tag: null,           swatch: '#E6C27A' },
    { id: 'esp',    cat: 'coffee',    name: 'Espresso',           desc: 'Single or double',             price:  7.00, tag: null,           swatch: '#3B1F0E' },
    { id: 'ame',    cat: 'coffee',    name: 'Americano',          desc: 'Long black',                   price:  8.50, tag: null,           swatch: '#5B3A1E' },
    { id: 'cap',    cat: 'coffee',    name: 'Cappuccino',         desc: 'Dry foam, cocoa dust',         price: 10.50, tag: null,           swatch: '#B8814D' },
    { id: 'moch',   cat: 'coffee',    name: 'Mocha',              desc: 'Dark chocolate + espresso',    price: 12.00, tag: null,           swatch: '#6B3A20' },
    { id: 'matcha', cat: 'noncoffee', name: 'Matcha Latte',       desc: 'Ceremonial grade, oat option', price: 12.50, tag: null,           swatch: '#8CA86A' },
    { id: 'choc',   cat: 'noncoffee', name: 'Hot Chocolate',      desc: '55% dark, steamed',            price: 11.00, tag: null,           swatch: '#6B3A20' },
    { id: 'chai',   cat: 'noncoffee', name: 'Spiced Chai',        desc: 'House-spiced, black tea',      price: 10.00, tag: null,           swatch: '#A66B3D' },
    { id: 'icel',   cat: 'cold',      name: 'Iced Latte',         desc: 'Over crushed ice',             price: 11.00, tag: null,           swatch: '#C9A07A' },
    { id: 'frap',   cat: 'cold',      name: 'Coffee Frappe',      desc: 'Blended, whipped top',         price: 13.50, tag: 'New',          swatch: '#B8875A' },
    { id: 'cold',   cat: 'cold',      name: 'Cold Brew',          desc: '18hr slow steep',              price: 12.00, tag: null,           swatch: '#3B1F0E' },
    { id: 'crois',  cat: 'pastry',    name: 'Almond Croissant',   desc: 'Warmed, paper bag ready',      price:  7.50, tag: null,           swatch: '#E3B876' },
    { id: 'muf',    cat: 'pastry',    name: 'Blueberry Muffin',   desc: 'Baked fresh daily',            price:  6.00, tag: null,           swatch: '#9A7BB0' },
    { id: 'kayab',  cat: 'pastry',    name: 'Kaya Butter Toast',  desc: 'Thick-cut, pandan kaya',       price:  6.50, tag: 'Local fav',    swatch: '#C9D66A' },
    { id: 'c1',     cat: 'combo',     name: 'Kopi + Toast',       desc: 'Kopi-O + Kaya toast set',      price: 13.00, tag: 'Save RM2',     swatch: '#4A2A14' },
    { id: 'c2',     cat: 'combo',     name: 'Latte + Danish',     desc: 'Any latte + butter danish',    price: 15.00, tag: 'Save RM2',     swatch: '#D9A977' },
  ],
  drinkCats: ['popular', 'coffee', 'noncoffee', 'cold'],
  modifiers: {
    size:  { label: 'Size',  required: true,  options: [{ id: 's', label: 'Regular', delta: 0 }, { id: 'm', label: 'Large', delta: 2.00 }] },
    milk:  { label: 'Milk',  required: false, options: [{ id: 'whole', label: 'Whole', delta: 0 }, { id: 'skim', label: 'Skim', delta: 0 }, { id: 'oat', label: 'Oat', delta: 2.00 }, { id: 'almond', label: 'Almond', delta: 2.00 }, { id: 'soy', label: 'Soy', delta: 1.50 }] },
    sugar: { label: 'Sugar', required: false, options: [{ id: 'none', label: 'None', delta: 0 }, { id: 'less', label: 'Less', delta: 0 }, { id: 'std', label: 'Normal', delta: 0 }, { id: 'extra', label: 'Extra', delta: 0 }] },
    ice:   { label: 'Ice',   required: false, coldOnly: true, options: [{ id: 'none', label: 'No ice' }, { id: 'less', label: 'Less' }, { id: 'std', label: 'Normal' }] },
    notes: { label: 'Notes to barista', kind: 'freeform', placeholder: 'e.g. extra hot, no foam' },
  },
  lastOrder: {
    when: 'Yesterday · 8:24 AM',
    items: [
      { id: 'flat',   qty: 1, mods: { size: 'm', milk: 'oat', sugar: 'less' } },
      { id: 'danish', qty: 1 },
    ],
  },
  loyalty: { program: 'Oasis Stamps', goal: 10, current: 7, reward: 'Free drink' },
};

export default MENU_DATA;
