import { SearchView } from '@/components/catalog/SearchView';
import { loadBundledCatalog } from '@/lib/catalog/loadBundledCatalog';

export default function SearchScreen() {
  return <SearchView loadCatalog={loadBundledCatalog} />;
}
