import dynamic from 'next/dynamic';

const MenuAppV2 = dynamic(() => import('@/components/MenuAppV2'), { ssr: false });

export const metadata = {
  title: 'Healthy Gelato — Coffee Oasis',
  description: 'Our healthy gelato menu.',
};

// Branded QR landing: opens the menu straight on the "healthy-gelato" category.
// The category id in product_categories must be "healthy-gelato" to match.
export default function HealthyGelato() {
  return <MenuAppV2 initialCat="healthy-gelato" />;
}
