export interface ItemIconRule {
  patterns: RegExp[];
  icon: string;
  bg: string;
  border: string;
}

// Color Palette Families
const PALETTE = {
  blue: { bg: '#f0f9ff', border: '#bae6fd' },       // Tech, Electronics
  pink: { bg: '#fdf4ff', border: '#f5d0fe' },       // Apparel, Beauty, Accessories
  rose: { bg: '#fff1f2', border: '#fecdd3' },       // Kitchen, Dining, Food
  gray: { bg: '#f1f5f9', border: '#cbd5e1' },       // Tools, Hardware, Auto
  green: { bg: '#f0fdf4', border: '#bbf7d0' },      // Outdoor, Garden, Books, Sports
  yellow: { bg: '#fffbeb', border: '#fde68a' },     // Lighting, Solar, Warm
  slate: { bg: '#f8fafc', border: '#e2e8f0' },      // Documents, Office, Paper
  red: { bg: '#fef2f2', border: '#fca5a5' },        // Medical, Safety, Fire
  teal: { bg: '#f0fdfa', border: '#99f6e4' },       // Bathroom, Cleaning
  indigo: { bg: '#fbfbfe', border: '#e0e7ff' },     // Toys, Games, Baby
  amber: { bg: '#fff7ed', border: '#ffedd5' },      // Furniture, Travel, Pet
};

export const ITEM_ICON_RULES: ItemIconRule[] = [
  // -------------------------------------------------------------
  // SPECIFIC ITEM OVERRIDES & HIGH-PRIORITY COMBINATIONS
  // -------------------------------------------------------------
  { patterns: [/\b(game controller|gamepad|joystick)\b/i], icon: '🎮', ...PALETTE.indigo },
  { patterns: [/\b(car battery)\b/i], icon: '🔋', ...PALETTE.gray },
  { patterns: [/\b(jumper cables?)\b/i], icon: '🔌', ...PALETTE.gray },
  { patterns: [/\b(desk lamp|table lamp|bedside lamp)\b/i], icon: '💡', ...PALETTE.yellow },
  { patterns: [/\b(christmas lights?|fairy lights?|string lights?|holiday lights?)\b/i], icon: '💡', ...PALETTE.yellow },
  { patterns: [/\b(hair dryer|blow dryer)\b/i], icon: '💇', ...PALETTE.teal },
  { patterns: [/\b(hair straightener|curling iron)\b/i], icon: '💇', ...PALETTE.teal },
  { patterns: [/\b(hairbrush|comb)\b/i], icon: '💇', ...PALETTE.teal },
  { patterns: [/\b(baby bottle)\b/i], icon: '🍼', ...PALETTE.indigo },
  { patterns: [/\b(pet food|dog food|cat food)\b/i], icon: '🐾', ...PALETTE.amber },
  { patterns: [/\b(extension cord|power strip)\b/i], icon: '🔌', ...PALETTE.yellow },
  { patterns: [/\b(ironing board)\b/i], icon: '🧺', ...PALETTE.teal },
  { patterns: [/\b(coffee mug|tea cup)\b/i], icon: '☕', ...PALETTE.rose },

  // -------------------------------------------------------------
  // ELECTRONICS & TECH
  // -------------------------------------------------------------
  { patterns: [/\b(iphone|smartphone|mobile phone|cell phone)\b/i], icon: '📱', ...PALETTE.blue },
  { patterns: [/\b(macbook|laptop|chromebook|computer|desktop pc)\b/i], icon: '💻', ...PALETTE.blue },
  { patterns: [/\b(ipad|tablet|e-reader|kindle)\b/i], icon: '📱', ...PALETTE.blue },
  { patterns: [/\b(television|tv|monitor|display screen)\b/i], icon: '📺', ...PALETTE.blue },
  { patterns: [/\b(camera|dslr|webcam|camcorder)\b/i], icon: '📷', ...PALETTE.blue },
  { patterns: [/\b(headphones|earbuds|airpods|headset)\b/i], icon: '🎧', ...PALETTE.blue },
  { patterns: [/\b(speaker|soundbar|subwoofer)\b/i], icon: '🔊', ...PALETTE.blue },
  { patterns: [/\b(keyboard)\b/i], icon: '⌨️', ...PALETTE.blue },
  { patterns: [/\b(mouse|trackpad)\b/i], icon: '🖱️', ...PALETTE.blue },
  { patterns: [/\b(printer|scanner|copier)\b/i], icon: '🖨️', ...PALETTE.blue },
  { patterns: [/\b(smartwatch|apple watch)\b/i], icon: '⌚', ...PALETTE.blue },
  { patterns: [/\b(remote control|tv remote)\b/i], icon: '🎛️', ...PALETTE.blue },
  { patterns: [/\b(router|modem|wifi router|access point)\b/i], icon: '📡', ...PALETTE.blue },
  { patterns: [/\b(battery|batteries|aa battery|aaa battery)\b/i], icon: '🔋', ...PALETTE.yellow },
  { patterns: [/\b(power bank|portable charger)\b/i], icon: '🔋', ...PALETTE.yellow },
  { patterns: [/\b(cable|cord|wire|charger|adapter|usb cable|hdmi)\b/i], icon: '🔌', ...PALETTE.yellow },

  // -------------------------------------------------------------
  // LIGHTING
  // -------------------------------------------------------------
  { patterns: [/\b(light bulb|bulb|led bulb)\b/i], icon: '💡', ...PALETTE.yellow },
  { patterns: [/\b(flashlight|torch|lantern)\b/i], icon: '🔦', ...PALETTE.yellow },
  { patterns: [/\b(lamp|light fixture)\b/i], icon: '💡', ...PALETTE.yellow },

  // -------------------------------------------------------------
  // KITCHEN & DINING
  // -------------------------------------------------------------
  { patterns: [/\b(plate|dinner plate|dishware)\b/i], icon: '🍽️', ...PALETTE.rose },
  { patterns: [/\b(cup|mug|glassware|tumbler)\b/i], icon: '☕', ...PALETTE.rose },
  { patterns: [/\b(drinking glass|water glass|wine glass)\b/i], icon: '🥛', ...PALETTE.rose },
  { patterns: [/\b(pot|frying pan|skillet|saucepan|cookware|wok)\b/i], icon: '🍳', ...PALETTE.rose },
  { patterns: [/\b(cutlery|fork|spoon|silverware)\b/i], icon: '🍴', ...PALETTE.rose },
  { patterns: [/\b(knife set|chef knife|kitchen knife)\b/i], icon: '🔪', ...PALETTE.rose },
  { patterns: [/\b(mixing bowl|bowl|salad bowl)\b/i], icon: '🥣', ...PALETTE.rose },
  { patterns: [/\b(kettle|tea kettle)\b/i], icon: '🫖', ...PALETTE.rose },
  { patterns: [/\b(coffee maker|espresso machine|nespresso)\b/i], icon: '☕', ...PALETTE.rose },
  { patterns: [/\b(blender|food processor|hand mixer)\b/i], icon: '🍳', ...PALETTE.rose },
  { patterns: [/\b(toaster|microwave|rice cooker|pressure cooker|instant pot)\b/i], icon: '🍳', ...PALETTE.rose },
  { patterns: [/\b(water bottle|thermos|flask|hydroflask)\b/i], icon: '🧃', ...PALETTE.rose },
  { patterns: [/\b(lunch box|bento box)\b/i], icon: '🍱', ...PALETTE.rose },

  // -------------------------------------------------------------
  // FOOD & PANTRY
  // -------------------------------------------------------------
  { patterns: [/\b(canned food|can of|canned soup|canned beans)\b/i], icon: '🥫', ...PALETTE.rose },
  { patterns: [/\b(snack|chips|popcorn|crackers|cookies)\b/i], icon: '🍿', ...PALETTE.rose },
  { patterns: [/\b(rice|grain)\b/i], icon: '🍚', ...PALETTE.rose },
  { patterns: [/\b(flour|wheat|baking powder)\b/i], icon: '🌾', ...PALETTE.rose },
  { patterns: [/\b(spice|spices|salt|pepper|seasoning)\b/i], icon: '🧂', ...PALETTE.rose },
  { patterns: [/\b(tea|tea bags)\b/i], icon: '🫖', ...PALETTE.rose },
  { patterns: [/\b(coffee beans|ground coffee)\b/i], icon: '☕', ...PALETTE.rose },
  { patterns: [/\b(water bottle|bottled water)\b/i], icon: '💧', ...PALETTE.rose },
  { patterns: [/\b(soda|juice|beverage|drink)\b/i], icon: '🥤', ...PALETTE.rose },

  // -------------------------------------------------------------
  // CLOTHING & ACCESSORIES
  // -------------------------------------------------------------
  { patterns: [/\b(t-shirt|shirt|blouse|top)\b/i], icon: '👕', ...PALETTE.pink },
  { patterns: [/\b(pants|jeans|trousers|shorts)\b/i], icon: '👖', ...PALETTE.pink },
  { patterns: [/\b(dress|skirt|gown)\b/i], icon: '👗', ...PALETTE.pink },
  { patterns: [/\b(jacket|coat|parka|blazer)\b/i], icon: '🧥', ...PALETTE.pink },
  { patterns: [/\b(socks|stockings)\b/i], icon: '🧦', ...PALETTE.pink },
  { patterns: [/\b(shoes|sneakers|cleats|sandals)\b/i], icon: '👟', ...PALETTE.pink },
  { patterns: [/\b(boots|winter boots|hiking boots)\b/i], icon: '🥾', ...PALETTE.pink },
  { patterns: [/\b(hat|cap|beanie|baseball cap)\b/i], icon: '🧢', ...PALETTE.pink },
  { patterns: [/\b(scarf)\b/i], icon: '🧣', ...PALETTE.pink },
  { patterns: [/\b(gloves|mittens)\b/i], icon: '🧤', ...PALETTE.pink },
  { patterns: [/\b(handbag|purse|clutch|tote bag)\b/i], icon: '👜', ...PALETTE.pink },
  { patterns: [/\b(backpack|knapsack)\b/i], icon: '🎒', ...PALETTE.pink },
  { patterns: [/\b(suitcase|luggage|duffel bag)\b/i], icon: '🧳', ...PALETTE.pink },
  { patterns: [/\b(jewelry|necklace|bracelet|ring|earrings)\b/i], icon: '💍', ...PALETTE.pink },
  { patterns: [/\b(watch|wrist watch)\b/i], icon: '⌚', ...PALETTE.pink },
  { patterns: [/\b(sunglasses|glasses|eyeglasses)\b/i], icon: '👓', ...PALETTE.pink },
  { patterns: [/\b(belt|leather belt)\b/i], icon: '👕', ...PALETTE.pink },

  // -------------------------------------------------------------
  // BATHROOM & PERSONAL CARE
  // -------------------------------------------------------------
  { patterns: [/\b(shampoo|conditioner|body wash|lotion|moisturizer|skincare|cream|face wash)\b/i], icon: '🧴', ...PALETTE.teal },
  { patterns: [/\b(toothbrush|electric toothbrush)\b/i], icon: '🪥', ...PALETTE.teal },
  { patterns: [/\b(toothpaste|dental floss)\b/i], icon: '🪥', ...PALETTE.teal },
  { patterns: [/\b(soap|bar soap|hand soap)\b/i], icon: '🧼', ...PALETTE.teal },
  { patterns: [/\b(towel|bath towel|hand towel|washcloth)\b/i], icon: '🧴', ...PALETTE.teal },
  { patterns: [/\b(makeup|cosmetics|lipstick|foundation|mascara)\b/i], icon: '💄', ...PALETTE.pink },
  { patterns: [/\b(perfume|cologne|fragrance)\b/i], icon: '💄', ...PALETTE.pink },
  { patterns: [/\b(razor|shaver|clipper)\b/i], icon: '🧴', ...PALETTE.teal },
  { patterns: [/\b(nail polish|nail clipper)\b/i], icon: '💅', ...PALETTE.pink },

  // -------------------------------------------------------------
  // MEDICAL & SAFETY
  // -------------------------------------------------------------
  { patterns: [/\b(first aid|first aid kit|bandage|bandages|gauze)\b/i], icon: '🩹', ...PALETTE.red },
  { patterns: [/\b(medicine|medication|pills|vitamins|tablets)\b/i], icon: '💊', ...PALETTE.red },
  { patterns: [/\b(thermometer)\b/i], icon: '🌡️', ...PALETTE.red },
  { patterns: [/\b(face mask|n95|respirator)\b/i], icon: '😷', ...PALETTE.red },
  { patterns: [/\b(fire extinguisher)\b/i], icon: '🧯', ...PALETTE.red },
  { patterns: [/\b(smoke detector|carbon monoxide detector)\b/i], icon: '🆘', ...PALETTE.red },
  { patterns: [/\b(emergency kit|survival kit)\b/i], icon: '🆘', ...PALETTE.red },

  // -------------------------------------------------------------
  // CLEANING & LAUNDRY
  // -------------------------------------------------------------
  { patterns: [/\b(broom|mop|dustpan)\b/i], icon: '🧹', ...PALETTE.teal },
  { patterns: [/\b(vacuum|vacuum cleaner|roomba)\b/i], icon: '🧹', ...PALETTE.teal },
  { patterns: [/\b(cleaning spray|cleaner|disinfectant|bleach|window cleaner)\b/i], icon: '🧴', ...PALETTE.teal },
  { patterns: [/\b(sponge|scrub sponge|scouring pad)\b/i], icon: '🧽', ...PALETTE.teal },
  { patterns: [/\b(laundry detergent|fabric softener|bleach|laundry pods)\b/i], icon: '🧺', ...PALETTE.teal },
  { patterns: [/\b(laundry basket|hamper)\b/i], icon: '🧺', ...PALETTE.teal },
  { patterns: [/\b(iron|clothes iron|steamer)\b/i], icon: '🧺', ...PALETTE.teal },

  // -------------------------------------------------------------
  // TOOLS & HARDWARE
  // -------------------------------------------------------------
  { patterns: [/\b(hammer)\b/i], icon: '🔨', ...PALETTE.gray },
  { patterns: [/\b(wrench|socket wrench)\b/i], icon: '🔧', ...PALETTE.gray },
  { patterns: [/\b(screwdriver)\b/i], icon: '🪛', ...PALETTE.gray },
  { patterns: [/\b(pliers|wire cutters)\b/i], icon: '🛠️', ...PALETTE.gray },
  { patterns: [/\b(power drill|drill|cordless drill)\b/i], icon: '🛠️', ...PALETTE.gray },
  { patterns: [/\b(saw|handsaw|circular saw)\b/i], icon: '🪚', ...PALETTE.gray },
  { patterns: [/\b(toolbox|tool chest)\b/i], icon: '🧰', ...PALETTE.gray },
  { patterns: [/\b(nails|screws|bolts|nuts|fasteners|washers)\b/i], icon: '🔩', ...PALETTE.gray },
  { patterns: [/\b(tape measure|measuring tape)\b/i], icon: '📏', ...PALETTE.gray },
  { patterns: [/\b(ladder|step stool)\b/i], icon: '🪜', ...PALETTE.gray },
  { patterns: [/\b(paint brush|paintbrush|paint roller)\b/i], icon: '🖌️', ...PALETTE.gray },
  { patterns: [/\b(paint can|paint supplies|primer)\b/i], icon: '🎨', ...PALETTE.gray },

  // -------------------------------------------------------------
  // OFFICE & DOCUMENTS
  // -------------------------------------------------------------
  { patterns: [/\b(books?|novel|textbook|cookbook|magazine)\b/i], icon: '📚', ...PALETTE.green },
  { patterns: [/\b(notebook|journal|diary|planner|sketchbook)\b/i], icon: '📓', ...PALETTE.slate },
  { patterns: [/\b(passport)\b/i], icon: '🛂', ...PALETTE.slate },
  { patterns: [/\b(document|paperwork|papers|certificate|contract|tax documents?|receipts?|records?)\b/i], icon: '📄', ...PALETTE.slate },
  { patterns: [/\b(pen|pencil|marker|highlighter)\b/i], icon: '✏️', ...PALETTE.slate },
  { patterns: [/\b(scissors)\b/i], icon: '✂️', ...PALETTE.slate },
  { patterns: [/\b(stapler|tape dispenser|office supplies)\b/i], icon: '📄', ...PALETTE.slate },
  { patterns: [/\b(folder|file folder|binder)\b/i], icon: '📁', ...PALETTE.slate },
  { patterns: [/\b(envelope|mail|letters)\b/i], icon: '✉️', ...PALETTE.slate },
  { patterns: [/\b(calendar|wall calendar)\b/i], icon: '📅', ...PALETTE.slate },

  // -------------------------------------------------------------
  // TOYS, GAMES & CHILDREN
  // -------------------------------------------------------------
  { patterns: [/\b(board game|catan|monopoly)\b/i], icon: '🎲', ...PALETTE.indigo },
  { patterns: [/\b(playing cards|deck of cards)\b/i], icon: '🃏', ...PALETTE.indigo },
  { patterns: [/\b(video game|playstation|xbox|nintendo|switch game)\b/i], icon: '🎮', ...PALETTE.indigo },
  { patterns: [/\b(diapers|baby wipes|nappy)\b/i], icon: '👶', ...PALETTE.indigo },
  { patterns: [/\b(stroller|pram|buggy)\b/i], icon: '👶', ...PALETTE.indigo },
  { patterns: [/\b(pacifier|teether)\b/i], icon: '👶', ...PALETTE.indigo },
  { patterns: [/\b(doll|nesting doll|barbie)\b/i], icon: '🪆', ...PALETTE.indigo },
  { patterns: [/\b(action figure|lego|toy car)\b/i], icon: '🧸', ...PALETTE.indigo },
  { patterns: [/\b(stuffed animal|teddy bear|plushie)\b/i], icon: '🧸', ...PALETTE.indigo },
  { patterns: [/\b(puzzle|jigsaw puzzle)\b/i], icon: '🧩', ...PALETTE.indigo },
  { patterns: [/\b(toy|toys)\b/i], icon: '🧩', ...PALETTE.indigo },

  // -------------------------------------------------------------
  // SPORTS & FITNESS
  // -------------------------------------------------------------
  { patterns: [/\b(football|soccer ball)\b/i], icon: '⚽', ...PALETTE.green },
  { patterns: [/\b(basketball)\b/i], icon: '🏀', ...PALETTE.green },
  { patterns: [/\b(baseball|softball)\b/i], icon: '⚾', ...PALETTE.green },
  { patterns: [/\b(tennis ball|tennis racket)\b/i], icon: '🎾', ...PALETTE.green },
  { patterns: [/\b(volleyball)\b/i], icon: '🏐', ...PALETTE.green },
  { patterns: [/\b(golf ball|golf clubs)\b/i], icon: '⛳', ...PALETTE.green },
  { patterns: [/\b(dumbbells|kettlebell|barbell|weights|weight plates)\b/i], icon: '🏋️', ...PALETTE.green },
  { patterns: [/\b(yoga mat|yoga block)\b/i], icon: '🧘', ...PALETTE.green },
  { patterns: [/\b(bicycle|bike)\b/i], icon: '🚲', ...PALETTE.green },
  { patterns: [/\b(helmet|bike helmet)\b/i], icon: '🪖', ...PALETTE.green },

  // -------------------------------------------------------------
  // OUTDOOR, CAMPING & TRAVEL
  // -------------------------------------------------------------
  { patterns: [/\b(tent|campsite tent)\b/i], icon: '⛺', ...PALETTE.green },
  { patterns: [/\b(sleeping bag|air mattress)\b/i], icon: '🛏️', ...PALETTE.green },
  { patterns: [/\b(camp stove|camping stove)\b/i], icon: '🔥', ...PALETTE.green },
  { patterns: [/\b(cooler|ice chest)\b/i], icon: '🧊', ...PALETTE.green },
  { patterns: [/\b(fishing rod|tackle box|fishing gear)\b/i], icon: '🎣', ...PALETTE.green },
  { patterns: [/\b(umbrella|rain umbrella)\b/i], icon: '☂️', ...PALETTE.green },
  { patterns: [/\b(beach towel|beach umbrella|sand toys)\b/i], icon: '🏖️', ...PALETTE.green },
  { patterns: [/\b(picnic basket|picnic blanket)\b/i], icon: '🧺', ...PALETTE.green },
  { patterns: [/\b(camping gear|outdoor gear)\b/i], icon: '⛺', ...PALETTE.green },

  // -------------------------------------------------------------
  // HOLIDAY & SEASONAL DECOR
  // -------------------------------------------------------------
  { patterns: [/\b(christmas ornaments?|christmas decorations?|christmas decor|xmas decor|wreath|garland|tree topper)\b/i], icon: '🎄', ...PALETTE.indigo },
  { patterns: [/\b(gift|present|wrapping paper|gift bag)\b/i], icon: '🎁', ...PALETTE.indigo },
  { patterns: [/\b(halloween|pumpkin|jack-o-lantern|halloween costume)\b/i], icon: '🎃', ...PALETTE.indigo },
  { patterns: [/\b(easter|easter eggs?)\b/i], icon: '🐣', ...PALETTE.indigo },
  { patterns: [/\b(birthday decorations?|party favors|balloons)\b/i], icon: '🎉', ...PALETTE.indigo },
  { patterns: [/\b(picture frame|photo frame|artwork|wall art|canvas print)\b/i], icon: '🖼️', ...PALETTE.amber },
  { patterns: [/\b(candle|candles|scented candle)\b/i], icon: '🕯️', ...PALETTE.amber },
  { patterns: [/\b(vase|flower vase)\b/i], icon: '🏺', ...PALETTE.amber },

  // -------------------------------------------------------------
  // HOME & FURNITURE
  // -------------------------------------------------------------
  { patterns: [/\b(sofa|couch|loveseat)\b/i], icon: '🛋️', ...PALETTE.amber },
  { patterns: [/\b(chair|desk chair|dining chair|armchair)\b/i], icon: '🪑', ...PALETTE.amber },
  { patterns: [/\b(desk|table|side table|coffee table)\b/i], icon: '🪑', ...PALETTE.amber },
  { patterns: [/\b(bed|mattress|bed frame)\b/i], icon: '🛏️', ...PALETTE.amber },
  { patterns: [/\b(pillow|cushion|throw pillow)\b/i], icon: '🛏️', ...PALETTE.amber },
  { patterns: [/\b(blanket|comforter|duvet|bedsheet|bedding|quilt)\b/i], icon: '🛏️', ...PALETTE.amber },
  { patterns: [/\b(curtains?|drapes?|window blinds?)\b/i], icon: '🛋️', ...PALETTE.amber },
  { patterns: [/\b(rug|carpet|mat)\b/i], icon: '🛋️', ...PALETTE.amber },
  { patterns: [/\b(mirror|wall mirror)\b/i], icon: '🪞', ...PALETTE.amber },
  { patterns: [/\b(clock|alarm clock|wall clock)\b/i], icon: '⏰', ...PALETTE.amber },
  { patterns: [/\b(fan|desk fan|ceiling fan)\b/i], icon: '🌬️', ...PALETTE.amber },
  { patterns: [/\b(space heater|heater)\b/i], icon: '🔥', ...PALETTE.amber },

  // -------------------------------------------------------------
  // GARDEN & YARD
  // -------------------------------------------------------------
  { patterns: [/\b(houseplant|plant|potted plant|succulent)\b/i], icon: '🪴', ...PALETTE.green },
  { patterns: [/\b(flower|flowers|bouquet)\b/i], icon: '🌸', ...PALETTE.green },
  { patterns: [/\b(watering can)\b/i], icon: '🌱', ...PALETTE.green },
  { patterns: [/\b(garden hose|hose nozzle)\b/i], icon: '🌱', ...PALETTE.green },
  { patterns: [/\b(lawn mower|grass trimmer)\b/i], icon: '🪴', ...PALETTE.green },
  { patterns: [/\b(seeds|flower seeds|seed packets)\b/i], icon: '🌱', ...PALETTE.green },
  { patterns: [/\b(potting soil|soil|fertilizer)\b/i], icon: '🌱', ...PALETTE.green },

  // -------------------------------------------------------------
  // PET SUPPLIES
  // -------------------------------------------------------------
  { patterns: [/\b(dog supplies|cat supplies|pet supplies|leash|pet toy|pet bed|cat litter|dog collar)\b/i], icon: '🐾', ...PALETTE.amber },

  // -------------------------------------------------------------
  // AUTOMOTIVE
  // -------------------------------------------------------------
  { patterns: [/\b(car supplies|automotive|motor oil|car wax|car wash)\b/i], icon: '🚗', ...PALETTE.gray },
  { patterns: [/\b(tire|car tire|spare tire)\b/i], icon: '🛞', ...PALETTE.gray },

  // -------------------------------------------------------------
  // MUSIC, HOBBIES & CRAFTS
  // -------------------------------------------------------------
  { patterns: [/\b(guitar|acoustic guitar|electric guitar)\b/i], icon: '🎸', ...PALETTE.pink },
  { patterns: [/\b(piano|keyboard instrument|synthesizer)\b/i], icon: '🎹', ...PALETTE.pink },
  { patterns: [/\b(violin|fiddle)\b/i], icon: '🎻', ...PALETTE.pink },
  { patterns: [/\b(drums|drum set)\b/i], icon: '🥁', ...PALETTE.pink },
  { patterns: [/\b(musical instrument|sheet music)\b/i], icon: '🎵', ...PALETTE.pink },
  { patterns: [/\b(sewing machine|sewing kit|thread|needles|knitting|yarn)\b/i], icon: '🧵', ...PALETTE.pink },
  { patterns: [/\b(craft supplies|art supplies|acrylic paint)\b/i], icon: '🎨', ...PALETTE.pink },

  // -------------------------------------------------------------
  // HOUSEHOLD & MISCELLANEOUS
  // -------------------------------------------------------------
  { patterns: [/\b(keys|keychain)\b/i], icon: '🔑', ...PALETTE.amber },
  { patterns: [/\b(lock|padlock)\b/i], icon: '🔒', ...PALETTE.amber },
  { patterns: [/\b(basket|storage basket|woven basket)\b/i], icon: '🧺', ...PALETTE.amber },
  { patterns: [/\b(shopping bag|tote bag|tote)\b/i], icon: '🛍️', ...PALETTE.amber },
  { patterns: [/\b(coat hanger|clothes hanger|hangers)\b/i], icon: '👕', ...PALETTE.pink },
  { patterns: [/\b(trash bags|garbage bags|trash can)\b/i], icon: '🗑️', ...PALETTE.slate },
];
