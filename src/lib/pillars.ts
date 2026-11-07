import type { PillarId } from '../types';

export interface PillarDef {
  id: PillarId;
  name: string;
  emoji: string;
  prompt: string; // shown in empty states and "what's missing" nudges
  keywords: string[]; // heuristic pillar suggestion; multi-word entries weigh more
}

export const PILLARS: PillarDef[] = [
  {
    id: 'food', name: 'Food & Menu', emoji: '🍲',
    prompt: "What's the one dish people would cross town for?",
    keywords: ['dish', 'menu', 'jollof', 'rice', 'chicken', 'suya', 'spice', 'spiced', 'sauce', 'fry', 'fried', 'grill', 'flavor', 'flavour', 'bowl', 'plate', 'plating', 'recipe', 'ingredient', 'pepper', 'plantain', 'stew', 'egusi', 'okra', 'collard', 'greens', 'cornbread', 'side', 'dessert', 'drink', 'marinade', 'smoke', 'smoky', 'season', 'taste', 'portion', 'protein', 'vegan', 'vegetarian', 'shito', 'puff', 'honey', 'brine', 'batch'],
  },
  {
    id: 'guest', name: 'Guest', emoji: '🙋',
    prompt: 'Who walks in the door, and how do they feel when they leave?',
    keywords: ['guest', 'guests', 'customer', 'customers', 'regular', 'regulars', 'crowd', 'neighborhood', 'family', 'kids', 'lunch crowd', 'feedback', 'review', 'allergy', 'dietary', 'audience', 'community', 'demographic', 'locals', 'students', 'office', 'offices', 'remembered', 'remember'],
  },
  {
    id: 'space', name: 'Space & Vibe', emoji: '🪵',
    prompt: 'Close your eyes: what does it look and sound like inside?',
    keywords: ['wood', 'tile', 'light', 'lighting', 'lamp', 'pendant', 'seating', 'stool', 'stools', 'bench', 'wall', 'mural', 'plant', 'color', 'colour', 'decor', 'music', 'playlist', 'soundtrack', 'sound', 'floor', 'window', 'patio', 'layout', 'neon', 'warm', 'cozy', 'interior', 'table', 'art', 'counter seating', 'glow', 'chalk', 'backsplash'],
  },
  {
    id: 'service', name: 'Service Model', emoji: '🛎️',
    prompt: 'How does a guest order, wait and eat?',
    keywords: ['order', 'ordering', 'register', 'kiosk', 'pickup', 'takeout', 'takeaway', 'delivery', 'pop-up', 'popup', 'ticket', 'speed', 'prep', 'station', 'flow', 'hours', 'pos', 'tablet', 'wait', 'catering', 'self-serve', 'to-go', 'counter service', 'order at', 'line moves', 'printer'],
  },
  {
    id: 'brand', name: 'Brand & Name', emoji: '🏷️',
    prompt: 'What will people call it, and what does it promise?',
    keywords: ['name', 'brand', 'logo', 'font', 'typography', 'story', 'tagline', 'slogan', 'instagram', 'social', 'packaging', 'label', 'merch', 'tote', 'identity', 'palette', 'heritage', 'website', 'sticker', 'wax print', 'kraft', 'branding'],
  },
  {
    id: 'team', name: 'Team & Culture', emoji: '👥',
    prompt: 'Who do you want beside you on the line?',
    keywords: ['team', 'staff', 'crew', 'hire', 'hiring', 'culture', 'training', 'pay', 'wage', 'tips', 'schedule', 'scheduling', 'mentor', 'burnout', 'morale', 'family meal', 'sous', 'dishwasher', 'turnover', 'respect', 'apprentice', 'cooks'],
  },
  {
    id: 'numbers', name: 'Numbers', emoji: '💵',
    prompt: 'What has to be true for this to pay the rent?',
    keywords: ['cost', 'price', 'pricing', 'margin', 'budget', 'rent', 'lease', 'profit', 'revenue', 'dollar', 'investor', 'loan', 'funding', 'food cost', 'labor', 'break-even', 'breakeven', 'equipment', 'permit', 'license', 'capital', 'sales', 'ticket average', 'deposit', 'savings', '$'],
  },
];

export const PILLAR_BY_ID: Record<PillarId, PillarDef> = Object.fromEntries(PILLARS.map((p) => [p.id, p])) as Record<PillarId, PillarDef>;
