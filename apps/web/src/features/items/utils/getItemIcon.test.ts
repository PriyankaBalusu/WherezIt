import { describe, it, expect } from 'vitest';
import { getItemIconAndStyle } from './getItemIcon';

describe('getItemIconAndStyle Rule System & Precedence', () => {
  describe('Rule Precedence Hierarchy', () => {
    it('1. Specific Item Name rule wins over confirmed Category', () => {
      // Desk Lamp in Electronics category -> matches 💡 (lamp item rule)
      expect(getItemIconAndStyle('Desk Lamp', 'Electronics').icon).toBe('💡');

      // Christmas Lights in Holiday category -> matches 💡 (lighting item rule)
      expect(getItemIconAndStyle('Christmas Lights', 'Holiday').icon).toBe('💡');

      // Game Controller in Electronics category -> matches 🎮 (controller item rule)
      expect(getItemIconAndStyle('Game Controller', 'Electronics').icon).toBe('🎮');

      // Hair Dryer in Electronics category -> matches 💇 (grooming item rule)
      expect(getItemIconAndStyle('Hair Dryer', 'Electronics').icon).toBe('💇');

      // Baby Bottle in Kitchen category -> matches 🍼 (baby bottle item rule)
      expect(getItemIconAndStyle('Baby Bottle', 'Kitchen').icon).toBe('🍼');

      // Car Battery in Automotive category -> matches 🔋 (battery item rule)
      expect(getItemIconAndStyle('Car Battery', 'Automotive').icon).toBe('🔋');

      // Pet Food in Food category -> matches 🐾 (pet food item rule)
      expect(getItemIconAndStyle('Pet Food', 'Food').icon).toBe('🐾');

      // Coffee Mug in Kitchen category -> matches ☕ (coffee mug item rule)
      expect(getItemIconAndStyle('Coffee Mug', 'Kitchen').icon).toBe('☕');
    });

    it('2. Category fallback applies when Item Name has no specific rule', () => {
      expect(getItemIconAndStyle('Unlabeled Device', 'Electronics').icon).toBe('💻');
      expect(getItemIconAndStyle('Random Pot', 'Kitchen').icon).toBe('🍳');
      expect(getItemIconAndStyle('Mystery Apparel', 'Clothing').icon).toBe('👕');
      expect(getItemIconAndStyle('Generic Novel', 'Books').icon).toBe('📚');
      expect(getItemIconAndStyle('Unknown Hardware', 'Tools').icon).toBe('🛠️');
      expect(getItemIconAndStyle('Child Plaything', 'Toys').icon).toBe('🧩');
      expect(getItemIconAndStyle('Old Paperwork', 'Documents').icon).toBe('📄');
      expect(getItemIconAndStyle('Living Room Seating', 'Furniture').icon).toBe('🛋️');
      expect(getItemIconAndStyle('Hygiene Product', 'Bathroom').icon).toBe('🧴');
      expect(getItemIconAndStyle('Canned Good', 'Pantry').icon).toBe('🥫');
      expect(getItemIconAndStyle('Exercise Equipment', 'Sports').icon).toBe('⚽');
      expect(getItemIconAndStyle('Camp Gear', 'Outdoor').icon).toBe('⛺');
      expect(getItemIconAndStyle('Seasonal Trimmings', 'Holiday').icon).toBe('🎨');
    });

    it('3. Generic fallback (📦) is returned when neither item nor category matches', () => {
      expect(getItemIconAndStyle('Random Misc Object #999').icon).toBe('📦');
      expect(getItemIconAndStyle('Unrecognized Item', null).icon).toBe('📦');
      expect(getItemIconAndStyle('', '').icon).toBe('📦');
    });
  });

  describe('Electronics & Tech Coverage', () => {
    it('resolves tech items to specific icons', () => {
      expect(getItemIconAndStyle('iPhone 15').icon).toBe('📱');
      expect(getItemIconAndStyle('MacBook Pro').icon).toBe('💻');
      expect(getItemIconAndStyle('iPad Air').icon).toBe('📱');
      expect(getItemIconAndStyle('4K Television').icon).toBe('📺');
      expect(getItemIconAndStyle('DSLR Camera').icon).toBe('📷');
      expect(getItemIconAndStyle('AirPods Max').icon).toBe('🎧');
      expect(getItemIconAndStyle('Bluetooth Speaker').icon).toBe('🔊');
      expect(getItemIconAndStyle('Mechanical Keyboard').icon).toBe('⌨️');
      expect(getItemIconAndStyle('Wireless Mouse').icon).toBe('🖱️');
      expect(getItemIconAndStyle('Laser Jet Printer').icon).toBe('🖨️');
      expect(getItemIconAndStyle('Apple Watch').icon).toBe('⌚');
      expect(getItemIconAndStyle('TV Remote').icon).toBe('🎛️');
      expect(getItemIconAndStyle('WiFi Router').icon).toBe('📡');
      expect(getItemIconAndStyle('AA Batteries').icon).toBe('🔋');
      expect(getItemIconAndStyle('HDMI Cable').icon).toBe('🔌');
    });
  });

  describe('Kitchen & Dining Coverage', () => {
    it('resolves kitchen items to specific icons', () => {
      expect(getItemIconAndStyle('Dinner Plate').icon).toBe('🍽️');
      expect(getItemIconAndStyle('Coffee Mug').icon).toBe('☕');
      expect(getItemIconAndStyle('Drinking Glass').icon).toBe('🥛');
      expect(getItemIconAndStyle('Frying Pan').icon).toBe('🍳');
      expect(getItemIconAndStyle('Silverware Cutlery').icon).toBe('🍴');
      expect(getItemIconAndStyle('Chef Knife Set').icon).toBe('🔪');
      expect(getItemIconAndStyle('Salad Bowl').icon).toBe('🥣');
      expect(getItemIconAndStyle('Tea Kettle').icon).toBe('🫖');
      expect(getItemIconAndStyle('Hydroflask Water Bottle').icon).toBe('🧃');
      expect(getItemIconAndStyle('Bento Lunch Box').icon).toBe('🍱');
    });
  });

  describe('Clothing, Accessories & Beauty Coverage', () => {
    it('resolves clothing and personal care items', () => {
      expect(getItemIconAndStyle('Cotton T-Shirt').icon).toBe('👕');
      expect(getItemIconAndStyle('Blue Jeans').icon).toBe('👖');
      expect(getItemIconAndStyle('Summer Dress').icon).toBe('👗');
      expect(getItemIconAndStyle('Winter Coat').icon).toBe('🧥');
      expect(getItemIconAndStyle('Wool Socks').icon).toBe('🧦');
      expect(getItemIconAndStyle('Running Sneakers').icon).toBe('👟');
      expect(getItemIconAndStyle('Hiking Boots').icon).toBe('🥾');
      expect(getItemIconAndStyle('Baseball Cap').icon).toBe('🧢');
      expect(getItemIconAndStyle('Leather Purse').icon).toBe('👜');
      expect(getItemIconAndStyle('Travel Backpack').icon).toBe('🎒');
      expect(getItemIconAndStyle('Diamond Necklace').icon).toBe('💍');
      expect(getItemIconAndStyle('Sunglasses').icon).toBe('👓');
      expect(getItemIconAndStyle('Moisturizing Shampoo').icon).toBe('🧴');
      expect(getItemIconAndStyle('Electric Toothbrush').icon).toBe('🪥');
      expect(getItemIconAndStyle('Bar Soap').icon).toBe('🧼');
      expect(getItemIconAndStyle('Red Lipstick').icon).toBe('💄');
    });
  });

  describe('Tools, Hardware & Medical Coverage', () => {
    it('resolves tools, hardware, and safety items', () => {
      expect(getItemIconAndStyle('Claw Hammer').icon).toBe('🔨');
      expect(getItemIconAndStyle('Socket Wrench').icon).toBe('🔧');
      expect(getItemIconAndStyle('Phillips Screwdriver').icon).toBe('🪛');
      expect(getItemIconAndStyle('Power Drill').icon).toBe('🛠️');
      expect(getItemIconAndStyle('Handsaw').icon).toBe('🪚');
      expect(getItemIconAndStyle('Heavy Duty Toolbox').icon).toBe('🧰');
      expect(getItemIconAndStyle('Steel Screws').icon).toBe('🔩');
      expect(getItemIconAndStyle('Tape Measure').icon).toBe('📏');
      expect(getItemIconAndStyle('Step Ladder').icon).toBe('🪜');
      expect(getItemIconAndStyle('Paint Brush').icon).toBe('🖌️');
      expect(getItemIconAndStyle('First Aid Kit').icon).toBe('🩹');
      expect(getItemIconAndStyle('Painkiller Medicine').icon).toBe('💊');
      expect(getItemIconAndStyle('Fire Extinguisher').icon).toBe('🧯');
    });
  });

  describe('Toys, Sports, Outdoor & Household Coverage', () => {
    it('resolves toys, sports, camping, and household items', () => {
      expect(getItemIconAndStyle('Catan Board Game').icon).toBe('🎲');
      expect(getItemIconAndStyle('Deck of Playing Cards').icon).toBe('🃏');
      expect(getItemIconAndStyle('Nintendo Switch Game').icon).toBe('🎮');
      expect(getItemIconAndStyle('Teddy Bear').icon).toBe('🧸');
      expect(getItemIconAndStyle('Jigsaw Puzzle').icon).toBe('🧩');
      expect(getItemIconAndStyle('Soccer Ball').icon).toBe('⚽');
      expect(getItemIconAndStyle('Dumbbells Weight').icon).toBe('🏋️');
      expect(getItemIconAndStyle('Yoga Mat').icon).toBe('🧘');
      expect(getItemIconAndStyle('Camping Tent').icon).toBe('⛺');
      expect(getItemIconAndStyle('Ice Cooler').icon).toBe('🧊');
      expect(getItemIconAndStyle('Rain Umbrella').icon).toBe('☂️');
      expect(getItemIconAndStyle('Christmas Ornaments').icon).toBe('🎄');
      expect(getItemIconAndStyle('Gift Box').icon).toBe('🎁');
      expect(getItemIconAndStyle('Halloween Pumpkin').icon).toBe('🎃');
      expect(getItemIconAndStyle('Living Room Sofa').icon).toBe('🛋️');
      expect(getItemIconAndStyle('Bed Pillow').icon).toBe('🛏️');
      expect(getItemIconAndStyle('Wall Mirror').icon).toBe('🪞');
      expect(getItemIconAndStyle('Houseplant').icon).toBe('🪴');
      expect(getItemIconAndStyle('Dog Leash').icon).toBe('🐾');
      expect(getItemIconAndStyle('Acoustic Guitar').icon).toBe('🎸');
      expect(getItemIconAndStyle('House Keys').icon).toBe('🔑');
      expect(getItemIconAndStyle('Trash Bags').icon).toBe('🗑️');
    });
  });
});
