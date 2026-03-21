export type Filters = {
  id: string;
  label: string;
  options: FilterOptions[];
};

export type FilterOptions = {
  value: any;
  label: string;
};
