import dynamic from 'next/dynamic';

const MenuAppV2 = dynamic(() => import('@/components/MenuAppV2'), { ssr: false });

export default function V2Page() {
  return <MenuAppV2 />;
}
