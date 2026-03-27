export interface KinrossSite {
  id: string;
  label: string;
  subsidiaryName: string;
  location: string;
  governingState: string;
}

export const KINROSS_SITES: KinrossSite[] = [
  {
    id: 'fort_knox',
    label: 'Fort Knox Mine',
    subsidiaryName: 'Kinross Gold U.S.A., Inc.',
    location: 'Fairbanks, AK',
    governingState: 'AK',
  },
  {
    id: 'manh_choh',
    label: 'Manh Choh',
    subsidiaryName: 'Kinross Gold U.S.A., Inc.',
    location: 'Tok, AK',
    governingState: 'AK',
  },
  {
    id: 'round_mountain',
    label: 'Round Mountain',
    subsidiaryName: 'Round Mountain Gold Corporation',
    location: 'Nye County, NV',
    governingState: 'NV',
  },
  {
    id: 'bald_mountain',
    label: 'Bald Mountain',
    subsidiaryName: 'Bald Mountain Mining LLC',
    location: 'Elko County, NV',
    governingState: 'NV',
  },
  {
    id: 'echo_bay',
    label: 'Greens Creek / Echo Bay',
    subsidiaryName: 'Echo Bay Minerals, Inc.',
    location: 'Republic, WA',
    governingState: 'WA',
  },
  {
    id: 'la_coipa',
    label: 'La Coipa',
    subsidiaryName: 'Compañía Minera Mantos de Oro',
    location: 'Atacama, Chile',
    governingState: '',
  },
  {
    id: 'paracatu',
    label: 'Paracatu',
    subsidiaryName: 'Kinross Brasil Mineração S.A.',
    location: 'Minas Gerais, Brazil',
    governingState: '',
  },
  {
    id: 'tasiast',
    label: 'Tasiast',
    subsidiaryName: 'Tasiast Mauritanie Limited S.A.',
    location: 'Inchiri, Mauritania',
    governingState: '',
  },
  {
    id: 'kinross_corporate',
    label: 'Kinross Corporate Office',
    subsidiaryName: 'Kinross Gold Corporation',
    location: 'Toronto, ON',
    governingState: '',
  },
];

export const US_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
];

export const CA_PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
];
