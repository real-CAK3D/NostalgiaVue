// The channel lineup. Numbers follow the NostalgiaVue dial plan:
//   1 2 4 5 7 11 14-20  Local media (your drives / Jellyfin, over Tailscale)
//   3                   Games (ROMs from your drive, played with EmulatorJS)
//   6 8 9 10 12 13 21-30 Local-area TV for your ZIP
//   31-200              NostalgiaVue cable (archive.org + a few YouTube)
//   201-299             YouTube channels
//   300-350             Podcasts
//   351-419             More cable
//   420-499             Bring-your-own channels
//   500-599             Pay-per-view / streaming shortcuts
import { settings } from './store.js';

export const SECTIONS = [
  { id: 'local',     label: 'LOCAL MEDIA',   nums: [1, 2, 4, 5, 7, 11, 14, 15, 16, 17, 18, 19, 20] },
  { id: 'games',     label: 'GAMES',         nums: [3] },
  { id: 'area',      label: 'LOCAL TV',      nums: [6, 8, 9, 10, 12, 13, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  { id: 'nostalgia', label: 'NOSTALGIA CABLE', from: 31, to: 200, add: true },
  { id: 'youtube',   label: 'YOUTUBE',       from: 201, to: 299, add: true },
  { id: 'podcasts',  label: 'PODCASTS',      from: 300, to: 350, add: true },
  { id: 'more',      label: 'MORE CABLE',    from: 351, to: 419, add: true },
  { id: 'byo',       label: 'BRING YOUR OWN', from: 420, to: 499, add: true },
  { id: 'ppv',       label: 'PAY-PER-VIEW',  from: 500, to: 599, add: true },
];
export const sectionOf = n => SECTIONS.find(s => s.nums ? s.nums.includes(n) : n >= s.from && n <= s.to);

// --- archive.org query helpers
const words = ws => ws.map(w => `"${w}"`).join(' OR ');
const T = (...ws) => `title:(${words(ws)})`;
const S = (...ws) => `subject:(${words(ws)})`;
const TS = (...ws) => `(${T(...ws)} OR ${S(...ws)})`;
const ADS = 'subject:(commercial OR commercials OR advertisement OR advertising)';
export const ADS_QUERY = ['collection:classic_tv_commercials', ADS];

const SEASONS = [
  ['New Year’s', TS('new year', 'new years eve', 'winter')],
  ['Valentine’s', TS('valentine', 'sweetheart', 'love story')],
  ['St. Patrick’s', TS('st. patrick', 'saint patrick', 'irish', 'ireland')],
  ['Springtime', TS('easter', 'spring', 'easter bunny')],
  ['Mother’s Day', TS('mother', 'mothers day', 'spring')],
  ['Summer Fun', TS('summer', 'beach', 'beach party', 'vacation')],
  ['Fourth of July', TS('fourth of july', 'independence day', 'fireworks')],
  ['Summer Camp', TS('summer camp', 'camp', 'surfing')],
  ['Back to School', TS('back to school', 'school', 'classroom')],
  ['Halloween', TS('halloween', 'trick or treat', 'haunted', 'ghost')],
  ['Thanksgiving', TS('thanksgiving', 'turkey', 'pilgrims', 'harvest')],
  ['Christmas', TS('christmas', 'santa claus', 'xmas', 'holiday')],
];
const season = () => SEASONS[new Date().getMonth()];

// a(n, cat, call, name, queries, extra)
const a = (n, cat, call, name, q, x = {}) => ({ n, cat, call, name, kind: 'archive', q: Array.isArray(q) ? q : [q], ...x });
const au = (n, cat, call, name, q, x = {}) => a(n, cat, call, name, q, { audio: true, ...x });
const yt = (n, cat, call, name, ids, x = {}) => ({ n, cat, call, name, kind: 'yt', yt: ids, ...x });
const web = (n, cat, call, name, url, x = {}) => ({ n, cat, call, name, kind: 'external', url, ...x });

const NOSTALGIA = [
  { n: 31, cat: 'GUIDE', call: 'NVTV', name: 'NostalgiaVue Guide', kind: 'guidech' },
  a(32, 'SHOPPING', 'SHOP', 'Shop-a-Rama', [TS('qvc', 'home shopping network', 'shop at home', 'home shopping'), S('infomercial', 'infomercials')]),
  a(33, 'SHOPPING', 'BIDS', 'Gavel-to-Gavel Auctions', [TS('auction', 'auctioneer', 'auctions', 'antiques roadshow')]),
  a(34, 'COMEDY', 'HOLY', 'Holy Moly Network', ['subject:(satire OR parody) AND subject:(religion OR church OR televangelist OR religious OR preacher)', T('life of brian', 'church lady', 'televangelist parody')], { desc: 'Nothing but religious satire and parody. Amen-ish.' }),
  { ...a(35, 'COMEDY', 'PYTH', 'Monty Python Flying Channel', [TS('monty python', 'flying circus')]), yt: ['UCGm3CO6LPcN-Y7HIuyE0Rew'] },
  a(36, 'CRIME', 'COPS', 'Cops & Chases', [TS('cops', 'police chase', 'car chase', 'high speed chase', 'police pursuit')]),
  a(37, 'CRIME', 'BEAT', 'Police Drama', ['collection:classic_tv AND subject:(police OR detective OR crime)', S('police drama', 'detective')]),
  a(38, 'CRIME', 'DRAG', 'Dragnet Danger', [TS('dragnet', 'highway patrol', 'm squad', 'the untouchables')]),
  a(39, 'CRIME', 'CORT', 'Courtroom', [TS('perry mason', 'courtroom', 'court tv', 'trial')]),
  { ...a(40, 'SCIENCE', 'NYE', 'Bill Nye Science Guy', [TS('bill nye')]), yt: ['UCjYM-YemQPCooH9U378GcVw'] },
  a(41, 'SCIENCE', 'WIZ', 'Mr. Wizard’s Lab', [TS('mr. wizard', 'mr wizard', 'watch mr. wizard')]),
  a(42, 'SCIENCE', 'SCI', 'Science Hour', [S('science', 'physics', 'chemistry', 'biology')]),
  a(43, 'SCIENCE', 'COSM', 'Cosmos Corner', [TS('carl sagan', 'cosmos', 'astronomy', 'planetarium')]),
  a(44, 'SCIENCE', 'NASA', 'Space Race', ['collection:nasa', S('nasa', 'space', 'apollo')]),
  a(45, 'SCIENCE', 'WILD', 'Nature Nook', [S('nature', 'wildlife', 'animals')]),
  a(46, 'SCIENCE', 'DINO', 'Dino Time', [TS('dinosaur', 'dinosaurs', 'prehistoric')]),
  a(47, 'SCIENCE', 'TECH', 'Computer Chronicles', ['collection:computerchronicles']),
  a(48, 'GAMING', 'GAME', 'Game Videos', ['collection:gamevideos']),
  a(49, 'GAMING', 'ARCD', 'Arcade Attract Mode', [TS('arcade', 'attract mode', 'pinball', 'video game commercial')]),
  a(50, 'MOVIES', 'SURF', 'Anything on Archive', ['downloads:[5000 TO *]'], { rows: 400 }),
  a(51, 'SPORTS', 'SPRT', 'Classic Sports', [S('sports', 'football', 'baseball', 'boxing', 'basketball')]),
  a(52, 'SPORTS', 'FITE', 'Fight Night', [S('boxing', 'prize fight', 'prizefight', 'boxer')]),
  a(53, 'SPORTS', 'WRST', 'Wrestling Ring', [S('wrestling', 'professional wrestling')]),
  a(54, 'SPORTS', 'BALL', 'The Ballpark', [S('baseball', 'world series')]),
  a(55, 'SPORTS', 'GRID', 'Gridiron', [S('football', 'nfl', 'college football')]),
  a(56, 'SPORTS', 'RACE', 'Speedway', [S('auto racing', 'nascar', 'racing', 'drag racing')]),
  a(57, 'SPORTS', 'SK8', 'Xtreme Zone', [S('skateboarding', 'surfing', 'bmx', 'snowboarding')]),
  a(58, 'SPORTS', 'OLYM', 'Olympic Flame', [TS('olympics', 'olympic games')]),
  a(59, 'SPORTS', 'LNKS', 'Links & Lanes', [S('golf', 'tennis', 'bowling')]),
  a(60, 'LIFESTYLE', 'CARS', 'Gearhead TV', [S('automobiles', 'automobile', 'cars', 'automotive', 'auto repair')]),
  a(61, 'LIFESTYLE', 'COOK', 'Kitchen Classics', [S('cooking', 'recipes', 'cookery')]),
  a(62, 'LIFESTYLE', 'CHEF', 'The Galloping Kitchen', [TS('julia child', 'french chef', 'galloping gourmet')]),
  a(63, 'LIFESTYLE', 'TRVL', 'Travelogue', [S('travel', 'travelogue', 'travelogues')]),
  a(64, 'LIFESTYLE', 'GYM', 'Aerobics Hour', [S('aerobics', 'exercise', 'workout', 'fitness')]),
  a(65, 'LIFESTYLE', 'HOME', 'Home Movies', [S('home movies', 'home movie')]),
  a(66, 'LIFESTYLE', 'CRFT', 'Crafty Corner', [S('crafts', 'woodworking', 'home improvement', 'how to', 'diy')]),
  a(67, 'NEWS', 'NEWS', 'News & Public Affairs', ['collection:newsandpublicaffairs']),
  a(68, 'NEWS', 'DOCS', 'Documentary Hour', ['subject:documentary']),
  a(69, 'NEWS', 'HIST', 'Time Machine', [S('history', 'historical')]),
  a(70, 'MOVIES', 'FLIX', 'Feature Presentation', ['collection:feature_films']),
  a(71, 'MOVIES', 'B&W', 'Black & White Theater', ['collection:feature_films AND year:[1920 TO 1959]']),
  a(72, 'MOVIES', 'NOIR', 'Noir After Dark', ['collection:Film_Noir', S('film noir', 'noir')]),
  a(73, 'MOVIES', 'SLNT', 'Silent Screen', ['collection:silent_films']),
  a(74, 'MOVIES', 'DRIV', 'Drive-In', [S('b-movie', 'b movie', 'drive-in', 'exploitation', 'grindhouse')]),
  a(75, 'MOVIES', 'KUNG', 'Kung Fu Theater', [S('martial arts', 'kung fu', 'karate')]),
  a(76, 'MOVIES', 'WAR', 'War Pictures', ['collection:feature_films AND subject:war', S('war film', 'world war ii')]),
  a(77, 'MOVIES', 'LOVE', 'Romance Reel', ['collection:feature_films AND subject:romance', S('romance', 'romantic comedy')]),
  a(78, 'MOVIES', 'SONG', 'Musical Matinee', ['collection:feature_films AND subject:(musical OR musicals)', S('musical', 'musicals')]),
  a(79, 'MOVIES', 'SUSP', 'Suspense Theater', [TS('hitchcock', 'suspense', 'thriller')]),
  a(80, 'MOVIES', 'FAML', 'Family Film Fest', ['collection:feature_films AND subject:family', S('family film', 'family')]),
  a(81, 'MOVIES', 'WRLD', 'World Cinema', [S('foreign film', 'world cinema', 'foreign language film')]),
  a(82, 'MOVIES', 'KAIJ', 'Monster Island', [TS('godzilla', 'gamera', 'kaiju', 'giant monster')]),
  a(83, 'MOVIES', 'SCFI', 'Sci-Fi Theater', ['collection:SciFi_Horror AND subject:("science fiction" OR sci-fi)', 'collection:SciFi_Horror']),
  a(84, 'MOVIES', 'TRLR', 'Trailer Park', ['collection:movie_trailers', S('trailer', 'trailers', 'movie trailer')]),
  a(85, 'MOVIES', 'CULT', 'Cult Classics', [S('cult film', 'cult classic', 'cult')]),
  a(86, 'MOVIES', 'SHRT', 'Short Subjects', [S('short film', 'short films', 'shorts')]),
  a(87, 'MOVIES', 'STAR', 'Golden Age Stars', [TS('cary grant', 'john wayne', 'humphrey bogart', 'bette davis', 'james stewart', 'orson welles')]),
  a(88, 'MOVIES', 'INDI', 'Indie Film Fest', ['subject:(independent OR "independent film" OR indie) AND year:[1990 TO 2030]']),
  a(89, 'COMEDY', 'RIFF', 'Riff Theater', [TS('mystery science theater 3000', 'mst3k', 'rifftrax', 'cinematic titanic')]),
  a(90, 'DRAMA', 'SPY', 'Spy Network', [S('spy', 'espionage', 'secret agent')]),
  a(91, 'WESTERN', 'TRAL', 'Dusty Trail Westerns', [S('western', 'westerns', 'cowboy')]),
  a(92, 'WESTERN', 'SADL', 'Saddle Pals', [TS('hopalong cassidy', 'roy rogers', 'lone ranger', 'gene autry', 'cisco kid')]),
  a(93, 'DRAMA', 'SRAL', 'Cliffhanger Serials', [S('serial', 'serials', 'movie serial', 'cliffhanger')]),
  a(94, 'SCI-FI', 'ROKT', 'Rocket Ranger', [TS('flash gordon', 'buck rogers', 'captain video', 'space patrol', 'rocky jones')]),
  a(95, 'CARTOONS', 'TOON', 'Toon Town', ['collection:classic_cartoons']),
  a(96, 'CARTOONS', 'LOON', 'Looney Lane', [TS('looney tunes', 'merrie melodies', 'bugs bunny', 'daffy duck', 'porky pig')]),
  a(97, 'CARTOONS', 'FLCH', 'Fleischer Flicks', [TS('betty boop', 'popeye', 'fleischer')]),
  a(98, 'CARTOONS', 'FELX', 'Felix & Friends', [TS('felix the cat', 'mighty mouse', 'woody woodpecker', 'casper', 'heckle and jeckle')]),
  a(99, 'CARTOONS', 'SUPR', 'Super Toons', [TS('superman', 'batman', 'spider-man', 'space ghost') + ' AND subject:(cartoon OR cartoons OR animation)', TS('superman', 'space ghost')]),
  a(100, 'CARTOONS', 'SATM', 'Saturday Morning Cartunes', ['subject:(cartoon OR cartoons OR animation) AND year:[1960 TO 1989]']),
  a(101, 'CARTOONS', 'NTUN', 'New Toons', ['subject:(animation OR animated OR cartoon) AND year:[2005 TO 2030]']),
  a(102, 'CARTOONS', 'ANIM', 'Animation Station', ['collection:animationandcartoons']),
  a(103, 'CARTOONS', 'ANME', 'Anime Express', ['subject:(anime OR "japanese animation")']),
  a(104, 'CARTOONS', 'CLAY', 'Stop-Motion Theater', [S('stop motion', 'stop-motion', 'claymation', 'puppet animation')]),
  a(105, 'KIDS', 'KIDS', 'Kid Vid', [S("children's television", "children's programming", 'kids tv'), 'subject:children']),
  a(106, 'KIDS', 'PUPT', 'Puppet Playhouse', [TS('howdy doody', 'kukla fran', 'puppet', 'marionette', 'lamb chop')]),
  a(107, 'KIDS', 'GUMB', 'Clay Pals', [TS('gumby', 'davey and goliath', 'pokey')]),
  a(108, 'CARTOONS', 'MOOS', 'Moose & Squirrel', [TS('rocky and bullwinkle', 'bullwinkle', 'underdog', 'tennessee tuxedo')]),
  a(109, 'COMEDY', 'STGE', 'Stooge-O-Rama', [TS('three stooges', '3 stooges')]),
  a(110, 'COMEDY', 'LAFF', 'Laff Track Sitcoms', ['collection:classic_tv AND subject:(sitcom OR comedy)']),
  a(111, 'COMEDY', 'CHKL', 'Chuckle Cinema', ['collection:feature_films AND subject:comedy']),
  a(112, 'COMEDY', 'SLAP', 'Slapstick Silents', ['collection:silent_films AND subject:comedy', TS('charlie chaplin', 'buster keaton', 'harold lloyd')]),
  a(113, 'COMEDY', 'L&H', 'Laurel & Hardy', [TS('laurel and hardy', 'laurel & hardy')]),
  a(114, 'COMEDY', 'RASC', 'Rascals Clubhouse', [TS('little rascals', 'our gang')]),
  a(115, 'COMEDY', 'A&C', 'Abbott & Costello', [TS('abbott and costello', 'abbott & costello')]),
  a(116, 'COMEDY', 'LUCY', 'Lucy & Desi', [TS('i love lucy', 'lucy show', 'lucille ball')]),
  a(117, 'COMEDY', 'MARX', 'Marx Bros. Madness', [TS('marx brothers', 'groucho marx')]),
  a(118, 'COMEDY', 'STND', 'Stand-Up Stage', [S('stand-up comedy', 'stand up comedy', 'standup', 'comedian')]),
  a(119, 'COMEDY', 'SKIT', 'Sketch Show', [S('sketch comedy', 'variety show', 'sketch')]),
  au(120, 'COMEDY', 'RLAF', 'Radio Laughs', ['collection:oldtimeradio AND subject:comedy', 'collection:oldtimeradio AND ' + TS('jack benny', 'fibber mcgee', 'burns and allen')]),
  a(121, 'COMEDY', 'HILL', 'Hillbilly Hour', [TS('beverly hillbillies', 'petticoat junction', 'green acres', 'andy griffith')]),
  a(122, 'COMEDY', 'VRTY', 'Variety Vault', [TS('jack benny', 'ed sullivan', 'red skelton', 'bob hope', 'milton berle', 'ernie kovacs')]),
  a(123, 'GAME SHOWS', 'BUZZ', 'Buzzer Beaters', [S('game show', 'game shows', 'quiz show'), T('you bet your life', "what's my line", 'to tell the truth')]),
  a(124, 'TALK', 'TALK', 'Late Night Talk', [S('talk show', 'late night', 'tonight show')]),
  a(125, 'DRAMA', 'CLSC', 'Classic TV', ['collection:classic_tv']),
  a(126, 'DRAMA', 'PLAY', 'Playhouse Drama', ['collection:classic_tv AND subject:drama', 'subject:drama AND subject:television']),
  a(127, 'SCI-FI', 'ZONE', 'Strange Signals', ['collection:classic_tv AND subject:("science fiction" OR "sci-fi" OR fantasy)']),
  a(128, 'DRAMA', 'SOAP', 'Soap Box', [S('soap opera', 'soap operas', 'soaps')]),
  a(129, 'DRAMA', 'ADVN', 'Adventure Hour', ['collection:classic_tv AND subject:adventure', 'subject:adventure']),
  au(130, 'DRAMA', 'MYST', 'Mystery Theater', ['collection:oldtimeradio AND subject:(mystery OR detective)', 'collection:oldtimeradio AND ' + TS('the shadow', 'sherlock holmes', 'dragnet')]),
  a(131, 'DRAMA', 'ANTH', 'Anthology Hour', [TS('alfred hitchcock presents', 'one step beyond', 'science fiction theatre', 'tales of tomorrow', 'lights out')]),
  a(132, 'DRAMA', 'WHDN', 'Whodunit', [TS('sherlock holmes', 'charlie chan', 'mr. moto', 'the saint', 'boston blackie')]),
  a(133, 'HORROR', 'FRGT', 'Fright Night', ['subject:horror']),
  a(134, 'HORROR', 'CHLR', 'Chiller Theater', [TS('vincent price', 'bela lugosi', 'boris karloff', 'lon chaney')]),
  a(135, 'HORROR', 'CRTR', 'Creature Feature', [S('monster', 'monsters', 'creature', 'creature feature')]),
  a(136, 'HORROR', 'ZMBI', 'Zombie Zone', [TS('zombie', 'zombies', 'night of the living dead')]),
  a(137, 'HORROR', 'FEAR', 'Sci-Fi & Horror', ['collection:SciFi_Horror']),
  au(138, 'HORROR', 'SPKR', 'Spooky Radio', ['collection:oldtimeradio AND ' + TS('suspense', 'inner sanctum', 'lights out', 'quiet please', 'the hermit', 'horror')]),
  a(139, 'HORROR', 'HOST', 'Horror Hosts', [TS('horror host', 'elvira', 'vampira', 'svengoolie', 'shock theater')]),
  { n: 140, cat: 'SEASONAL', call: 'HOLI', kind: 'archive', get name() { return season()[0] + ' Channel'; }, get q() { return [season()[1]]; } },
  a(141, 'SEASONAL', 'XMAS', 'Yule Channel', [TS('christmas', 'santa claus', 'xmas')]),
  a(142, 'SEASONAL', 'BOO', 'Halloween HQ', [TS('halloween', 'trick or treat', 'haunted house')]),
  a(143, 'SCI-FI', 'UFO', 'Paranormal Pursuits', [S('ufo', 'ufos', 'paranormal', 'bigfoot', 'ghosts', 'unexplained')]),
  a(144, 'MUSIC', 'VJTV', 'VJ-TV', ['subject:("music video" OR "music videos") AND year:[1980 TO 1999]', 'subject:"music video"'], { desc: 'Wall-to-wall music videos, the way cable used to be.' }),
  a(145, 'MUSIC', 'CLIP', 'Video Jukebox', [S('music video', 'music videos')]),
  a(146, 'MUSIC', '80S', 'Totally 80s', ['subject:("music video" OR "music videos") AND year:[1980 TO 1989]', S('80s', '1980s', 'new wave', 'synthpop')]),
  au(147, 'MUSIC', '90S', 'Alt Nation 90s', [S('grunge', 'alternative rock', '90s', '1990s')]),
  au(148, 'MUSIC', 'ROCK', 'Rock Block', [S('rock', 'hard rock', 'classic rock')]),
  au(149, 'MUSIC', 'MTAL', 'Headbanger’s Hall', [S('heavy metal', 'metal', 'thrash metal')]),
  au(150, 'MUSIC', 'PUNK', 'Punk Garage', [S('punk', 'punk rock', 'hardcore punk')]),
  au(151, 'MUSIC', 'HIPH', 'Hip-Hop Block', [S('hip hop', 'hip-hop', 'rap')]),
  au(152, 'MUSIC', 'DISC', 'Disco Inferno', [S('disco', 'funk', 'soul')]),
  a(153, 'MUSIC', 'SNDY', 'Soundies', [TS('soundie', 'soundies', 'scopitone')]),
  au(154, 'MUSIC', 'LIVE', 'Live Concert Radio', ['collection:etree']),
  au(155, 'MUSIC', 'DEAD', 'Dead Air', ['collection:GratefulDead']),
  a(156, 'MUSIC', 'CNCT', 'Concert Hall', [S('concert', 'live performance', 'live music')]),
  au(157, 'MUSIC', '78RP', 'Jukebox 78', ['collection:georgeblood']),
  au(158, 'MUSIC', 'OLDS', 'Oldies Radio', [S('rock and roll', 'doo-wop', 'doo wop', 'rhythm and blues', 'rockabilly')]),
  au(159, 'MUSIC', 'JAZZ', 'Jazz Club', ['subject:jazz']),
  au(160, 'MUSIC', 'CNTY', 'Country Roads', [S('country', 'bluegrass', 'hillbilly', 'western swing')]),
  au(161, 'MUSIC', 'SWNG', 'Big Band Ballroom', [S('big band', 'swing', 'dance band', 'dance orchestra')]),
  au(162, 'MUSIC', 'CLSL', 'Classical Concert', ['subject:classical']),
  au(163, 'MUSIC', 'BLUS', 'Blues Shack', ['subject:blues']),
  au(164, 'MUSIC', 'CHIP', 'Chiptune Arcade', [S('chiptune', '8bit', '8-bit', 'chipmusic')]),
  au(165, 'MUSIC', 'NETL', 'Netlabel Music', ['collection:netlabels']),
  au(166, 'RADIO', 'OTR', 'Old Time Radio', ['collection:oldtimeradio']),
  au(167, 'MUSIC', 'MALL', 'Mall Music', [S('vaporwave', 'muzak', 'elevator music', 'easy listening', 'lounge')]),
  a(168, 'MUSIC', 'KARA', 'Karaoke Night', [TS('karaoke', 'sing along', 'sing-along')]),
  a(169, 'LEARNING', 'SCHL', 'Schoolhouse Films', ['collection:prelinger AND subject:(educational OR "educational film")', S('educational film', 'educational')]),
  a(170, 'LEARNING', 'MENT', 'Mental Hygiene', [S('social guidance', 'mental hygiene', 'etiquette')]),
  a(171, 'LEARNING', 'DUCK', 'Duck & Cover', [S('civil defense', 'atomic bomb', 'cold war', 'nuclear')]),
  a(172, 'LEARNING', 'SAFE', 'Safety First', [TS('safety film', 'driver education', 'drivers ed', 'safety')]),
  a(173, 'LEARNING', 'INDS', 'Industrial Films', [S('industrial film', 'industrial films', 'sponsored film')]),
  a(174, 'ADS & TV', 'ADS', 'Ad Break', ADS_QUERY),
  a(175, 'ADS & TV', 'TOYZ', 'Toy & Cereal Ads', [ADS + ' AND ' + TS('toy', 'toys', 'cereal', 'barbie', 'g.i. joe', 'hot wheels')]),
  a(176, 'ADS & TV', 'PSA', 'PSA Network', [S('public service announcement', 'public service announcements', 'psa')]),
  a(177, 'ADS & TV', 'BUMP', 'Bumpers & Station IDs', [S('bumper', 'bumpers', 'station id', 'station identification', 'ident', 'sign-off')]),
  a(178, 'ADS & TV', 'VHS', 'Rewind VHS', [S('vhs', 'vhs rip', 'videotape', 'home video')]),
  a(179, 'ADS & TV', 'INFO', 'Infomercial Island', [S('infomercial', 'infomercials', 'home shopping')]),
  a(180, 'ADS & TV', 'PUBA', 'Public Access', [S('public access', 'public access television', 'community television')]),
  a(181, 'ARCHIVES', 'PREL', 'Prelinger Archives', ['collection:prelinger']),
  a(182, 'ARCHIVES', 'EPHM', 'Ephemeral Films', ['collection:ephemera']),
  a(183, 'NEWS', 'REEL', 'Newsreel Theater', [TS('newsreel', 'universal newsreel', 'movietone', 'pathe')]),
  a(184, 'NEWS', 'WWII', 'World at War', [S('world war ii', 'world war 2', 'wwii')]),
  a(185, 'NEWS', 'OVAL', 'Oval Office', [S('presidents', 'president', 'politics', 'campaign')]),
  a(186, 'SCIENCE', 'MOON', 'Moonshot', [TS('apollo 11', 'moon landing', 'apollo')]),
  a(187, 'LIFESTYLE', 'PETS', 'Pet Patrol', [S('dogs', 'cats', 'pets')]),
  a(188, 'LIFESTYLE', 'RAIL', 'Rail Fan', [S('trains', 'railroad', 'railway', 'locomotive')]),
  a(189, 'LIFESTYLE', 'WING', 'Wings', [S('aviation', 'airplanes', 'aircraft', 'airshow')]),
  a(190, 'SCIENCE', 'DEEP', 'Deep Blue', [S('ocean', 'underwater', 'marine life', 'sea')]),
  a(191, 'KIDS', 'READ', 'Story Time', [S('storytelling', "children's stories", 'fairy tales', 'read aloud')]),
  a(192, 'KIDS', 'FAIR', 'Fairy Tale Theater', [TS('fairy tale', 'cinderella', 'snow white', 'sleeping beauty', 'jack and the beanstalk')]),
  a(193, 'WORLD', 'BOLY', 'Bollywood Nights', [S('bollywood', 'hindi film', 'indian film')]),
  a(194, 'WORLD', 'NOVL', 'Telenovela', [S('telenovela', 'cine mexicano', 'mexican cinema', 'spanish')]),
  a(195, 'WORLD', 'BRIT', 'Brit Box', [S('british comedy', 'british television', 'bbc', 'british')]),
  a(196, 'WORLD', 'NRTH', 'Great White North', [S('canada', 'canadian', 'national film board')]),
  a(197, 'ARCHIVES', 'ART', 'Art House', [S('experimental film', 'avant-garde', 'art film', 'video art')]),
  a(198, 'GAMING', 'DEMO', 'Demoscene', [S('demoscene', 'demo scene', 'computer demo')]),
  a(199, 'LIFESTYLE', 'SLOW', 'Slow TV', [S('slow tv', 'relaxing', 'fireplace', 'yule log', 'aquarium')]),
  a(200, 'MOVIES', 'RLTT', 'Channel Roulette', ['downloads:[1000 TO *]'], { rows: 400 }),
];

const YOUTUBE = [
  yt(201, 'YOUTUBE', '[AS]', 'Adult Swim', ['UCgPClNr5VSYC3syrDUIlzLw']),
  yt(202, 'YOUTUBE', 'CN', 'Cartoon Network', ['UCMsgXPD3wzzt8RxHJmXH7hQ', 'UCXoZJ2AaqhF8SF0Fgt2RYIw']),
  yt(203, 'YOUTUBE', 'WBK', 'Looney Tunes · WB Kids', ['UC9trsD1jCTXXtN3xIOIU8gg']),
  yt(204, 'YOUTUBE', 'BEAN', 'Mr Bean', ['UCkAGrHCLFmlK3H2kd6isipg']),
  yt(205, 'YOUTUBE', 'PBSK', 'PBS Kids', ['UCmNIdCsMr-kjBzpzFH14cZg']),
  yt(206, 'YOUTUBE', 'CNAS', 'Cartoon Network Asia', ['UC9hVEGaTpAYMVd-bRsOYKwA']),
  // IDs below are unconfirmed; if YouTube refuses them the channel falls back to archive.org
  yt(207, 'YOUTUBE', 'SNL', 'Saturday Night Live', ['UCqFzWxSCi39LnW1JKFR3efg'], { q: [TS('saturday night live', 'snl')] }),
  yt(208, 'YOUTUBE', 'MAD', 'MADtv', ['UCVQHDhC-5u7ze2qWNyTGM3g'], { q: [TS('mad tv', 'madtv')] }),
];

const MORE = [
  a(351, 'COMEDY', 'SKCH', 'Sketch Comedy Classics', [TS('saturday night live', 'snl', 'in living color', 'kids in the hall', 'sctv', 'mad tv')]),
  a(352, 'COMEDY', '80SC', '80s Sitcoms', ['subject:sitcom AND year:[1980 TO 1989]', S('80s sitcom', 'sitcom')]),
  a(353, 'DRAMA', '90TV', '90s TV', ['subject:(television OR tv) AND year:[1990 TO 1999]']),
  a(354, 'KIDS', 'TOKU', 'Tokusatsu Theater', [TS('power rangers', 'ultraman', 'super sentai', 'tokusatsu', 'kamen rider')]),
  a(355, 'CARTOONS', 'ROBO', 'Robot Rumble', [TS('transformers', 'voltron', 'robotech', 'mecha', 'gundam')]),
  a(356, 'CARTOONS', 'CTAD', 'Cartoon Commercials', [ADS + ' AND ' + TS('cartoon', 'kids', 'cereal')]),
  a(357, 'SPORTS', 'SKTV', 'Skate Videos', [S('skate video', 'skateboard', 'skateboarding')]),
  a(358, 'HORROR', 'GHST', 'Ghost Hunters', [TS('ghost', 'haunted', 'poltergeist', 'ghost hunting')]),
  a(359, 'SCI-FI', 'CONS', 'Conspiracy Corner', [S('conspiracy', 'conspiracy theory', 'jfk assassination', 'area 51')]),
  a(360, 'LIFESTYLE', 'TRCK', 'Big Rig Radio', [S('trucks', 'trucking', 'big rig')]),
  a(361, 'SPORTS', 'MNST', 'Monster Truck Mayhem', [TS('monster truck', 'monster trucks', 'demolition derby')]),
  a(362, 'LIFESTYLE', 'MOTO', 'Motorcycle Mania', [S('motorcycle', 'motorcycles', 'harley-davidson', 'motocross')]),
  a(363, 'LIFESTYLE', 'HROD', 'Hot Rod Heaven', [S('hot rod', 'hot rods', 'muscle car', 'drag racing')]),
  a(364, 'LIFESTYLE', 'FISH', 'Gone Fishin’', [S('fishing', 'fly fishing', 'bass fishing')]),
  a(365, 'LIFESTYLE', 'WOOD', 'Great Outdoors', [S('hunting', 'outdoors', 'camping', 'hiking')]),
  a(366, 'LIFESTYLE', 'FARM', 'Farm Report', [S('farming', 'agriculture', 'tractor', 'farm')]),
  a(367, 'NEWS', 'STRM', 'Storm Center', [S('tornado', 'hurricane', 'storm', 'natural disaster')]),
  a(368, 'SCIENCE', 'MEDC', 'Medical Marvels', [S('medicine', 'medical', 'surgery', 'health')]),
  a(369, 'HORROR', 'MADS', 'Mad Scientist Lab', [TS('mad scientist', 'frankenstein', 'dr. jekyll')]),
  a(370, 'SCIENCE', 'BOTS', 'Robots & Brains', [S('robots', 'robot', 'artificial intelligence', 'automation')]),
  a(371, 'GAMING', 'RTRO', 'Retro Computing', [S('home computer', 'commodore', 'apple ii', 'atari', 'computers')]),
  a(372, 'GAMING', 'HACK', 'Hacker TV', [TS('hacker', 'hacking', 'phreaking', 'def con')]),
  a(373, 'GAMING', 'CNSL', 'Console Wars Ads', [ADS + ' AND ' + TS('nintendo', 'sega', 'playstation', 'atari')]),
  a(374, 'GAMING', 'PLAY', 'Let’s Play', [S("let's play", 'lets play', 'gameplay', 'walkthrough')]),
  a(375, 'GAMING', 'SPDR', 'Speedrun Central', [S('speedrun', 'speedruns', 'tool-assisted speedrun')]),
  a(376, 'GAMING', 'PNBL', 'Pinball Wizard', [S('pinball', 'pinball machine')]),
  a(377, 'LIFESTYLE', 'MAGC', 'Magic & Illusion', [S('magic', 'magician', 'illusion', 'magic tricks')]),
  a(378, 'LIFESTYLE', 'CRCS', 'Big Top Circus', [S('circus', 'clowns', 'carnival', 'sideshow')]),
  a(379, 'COMEDY', 'VENT', 'Ventriloquist Hour', [TS('ventriloquist', 'ventriloquism', 'dummy')]),
  a(380, 'MUSIC', 'DNCE', 'Dance Party', [TS('american bandstand', 'soul train', 'dance party', 'shindig', 'hullabaloo')]),
  au(381, 'MUSIC', 'LNGE', 'Lounge Lizard', [S('lounge', 'exotica', 'space age pop')]),
  au(382, 'MUSIC', 'PLKA', 'Polka Party', ['subject:polka']),
  au(383, 'MUSIC', 'SKNK', 'Reggae & Ska', [S('reggae', 'ska', 'dub')]),
  au(384, 'MUSIC', 'LATN', 'Latin Heat', [S('latin', 'salsa', 'mambo', 'cumbia')]),
  au(385, 'MUSIC', 'FOLK', 'Folk Fest', [S('folk', 'folk music', 'singer-songwriter')]),
  au(386, 'MUSIC', 'RAVE', 'Rave Cave', [S('electronic', 'techno', 'house', 'trance')]),
  au(387, 'MUSIC', 'AMBT', 'Ambient Lounge', [S('ambient', 'drone', 'new age')]),
  au(388, 'MUSIC', 'SCOR', 'Soundtrack City', [S('soundtrack', 'film score', 'movie soundtrack')]),
  au(389, 'MUSIC', 'VGM', 'Video Game Music', [S('video game music', 'vgm', 'game soundtrack')]),
  au(390, 'COMEDY', 'LPLF', 'Comedy Albums', [S('comedy album', 'comedy records', 'comedy recording')]),
  au(391, 'RADIO', 'RDRA', 'Radio Dramas', ['collection:oldtimeradio AND subject:drama']),
  au(392, 'RADIO', 'XM1', 'Sci-Fi Radio', ['collection:oldtimeradio AND ' + TS('x minus one', 'dimension x', 'science fiction')]),
  au(393, 'RADIO', 'GUNS', 'Western Radio', ['collection:oldtimeradio AND ' + TS('gunsmoke', 'have gun will travel', 'western')]),
  au(394, 'RADIO', 'KRAD', 'Kids Radio', ['collection:oldtimeradio AND ' + S('children', 'kids', "children's")]),
  au(395, 'RADIO', 'BOOK', 'Audiobook Corner', ['collection:librivoxaudio']),
  au(396, 'RADIO', 'POEM', 'Poetry Hour', [TS('poetry', 'poem', 'poems')]),
  au(397, 'RADIO', 'SPCH', 'Great Speeches', [S('speeches', 'speech', 'oratory')]),
  au(398, 'RADIO', 'NMBR', 'Numbers Station', [TS('numbers station', 'shortwave', 'conet project')]),
  au(399, 'RADIO', 'SNDS', 'Nature Sounds', [S('nature sounds', 'field recording', 'birdsong', 'rain sounds')]),
  a(400, 'MOVIES', 'BAD', 'So Bad It’s Good', [S('bad movie', 'bad movies', 'so bad it\'s good'), T('plan 9 from outer space', 'manos', 'robot monster')]),
  a(401, 'MOVIES', 'DSTR', 'Disaster Flicks', [S('disaster film', 'disaster movie', 'disaster')]),
  a(402, 'MOVIES', 'TEEN', 'Teen Flicks', [S('teen', 'teenagers', 'juvenile delinquency', 'teen film')]),
  a(403, 'MOVIES', 'BIKR', 'Biker Flicks', [S('biker film', 'motorcycle gang', 'bikers')]),
  a(404, 'MOVIES', 'BCHP', 'Beach Party', [TS('beach party', 'surf film', 'gidget', 'beach blanket')]),
  a(405, 'ARCHIVES', 'FAIR', 'World’s Fair', [TS("world's fair", 'worlds fair', 'expo', 'world of tomorrow')]),
  a(406, 'LIFESTYLE', 'RT66', 'Roadside America', [S('road trip', 'route 66', 'roadside', 'motel')]),
  a(407, 'LIFESTYLE', 'STYL', 'Vintage Fashion', [S('fashion', 'fashion show', 'style')]),
  au(408, 'ADS & TV', 'JNGL', 'Jingle Jukebox', [S('jingle', 'jingles', 'advertising music', 'radio commercials')]),
  { n: 409, cat: 'ADS & TV', call: 'TEST', name: 'Test Pattern', kind: 'bars', desc: 'Color bars and a 1 kHz tone. The 3 a.m. classic.' },
  a(410, 'SEASONAL', 'SPCL', 'Holiday Specials', [TS('christmas special', 'holiday special', 'easter special', 'thanksgiving special')]),
  a(411, 'ARCHIVES', 'LOST', 'Lost Media', [S('lost media', 'rare footage', 'found footage', 'unaired')]),
  a(412, 'ARCHIVES', 'MNDO', 'Mondo Weird', [S('mondo', 'bizarre', 'strange', 'weird')]),
  a(413, 'KIDS', '90KD', '90s Kids', ["subject:(\"children's television\" OR kids OR children) AND year:[1990 TO 1999]"]),
  a(414, 'KIDS', 'SESM', 'Sunny Street Learning', [TS('sesame street', 'mister rogers', 'electric company', '3-2-1 contact', 'zoom')]),
  a(415, 'TALK', 'LATE', 'Last Call', [S('late night', 'after hours', 'insomnia', 'late show')]),
  a(416, 'COMEDY', 'ROST', 'Roast Pit', [TS('roast', 'celebrity roast', 'dean martin roast')]),
  a(417, 'COMEDY', 'PRNK', 'Prank Patrol', [TS('candid camera', 'prank', 'pranks', 'hidden camera')]),
  a(418, 'DRAMA', 'HOSP', 'General Hospital Hour', [S('hospital', 'doctors', 'nurses', 'medical drama')]),
  a(419, 'TALK', 'SIGN', 'Sign-Off', [S('sign-off', 'sign off', 'national anthem', 'station sign off')]),
];

const POD = 'collection:podcasts';
const PODCASTS = [
  yt(300, 'PODCASTS', 'JRE', 'The Joe Rogan Experience', ['UCzQUP1qoWDoEbmsQxvdjxgQ']),
  yt(301, 'PODCASTS', 'STAR', 'StarTalk w/ Neil deGrasse Tyson', ['UCqoAEDirJPjEUFcF2FklnBA']),
  au(302, 'PODCASTS', 'POD', 'Podcast Radio', [POD]),
  au(303, 'PODCASTS', 'LOLZ', 'Comedy Podcasts', [POD + ' AND subject:comedy']),
  au(304, 'PODCASTS', 'NERD', 'Science Podcasts', [POD + ' AND subject:science']),
  au(305, 'PODCASTS', 'CRIM', 'True Crime Podcasts', [POD + ' AND ' + S('true crime', 'crime')]),
  au(306, 'PODCASTS', 'BYTE', 'Tech Podcasts', [POD + ' AND ' + S('technology', 'tech', 'computers')]),
  au(307, 'PODCASTS', 'PAST', 'History Podcasts', [POD + ' AND subject:history']),
  au(308, 'PODCASTS', 'CALL', 'Talk Radio', [S('talk radio', 'call-in show', 'radio talk show')]),
  au(309, 'PODCASTS', 'OWL', 'Night Owl Radio', [TS('coast to coast am', 'art bell', 'george noory')]),
  au(310, 'PODCASTS', 'JOCK', 'Sports Talk', [POD + ' AND subject:sports']),
];

const PPV = [
  web(500, 'PPV', 'PPV1', 'NostalgiaVue PPV Events', 'https://archive.org/details/feature_films', { ppv: true, desc: 'Tonight’s main event, priced at $0.00. Opens archive.org feature films.' }),
  web(501, 'PPV', 'NFLX', 'Netflix', 'https://www.netflix.com/'),
  web(502, 'PPV', 'PRIM', 'Prime Video', 'https://www.primevideo.com/'),
  web(503, 'PPV', 'DSNY', 'Disney+', 'https://www.disneyplus.com/'),
  web(504, 'PPV', 'MAX', 'Max', 'https://www.max.com/'),
  web(505, 'PPV', 'HULU', 'Hulu', 'https://www.hulu.com/'),
  web(506, 'PPV', 'PCCK', 'Peacock', 'https://www.peacocktv.com/'),
  web(507, 'PPV', 'PARA', 'Paramount+', 'https://www.paramountplus.com/'),
  web(508, 'PPV', 'PLUT', 'Pluto TV', 'https://pluto.tv/'),
  web(509, 'PPV', 'TUBI', 'Tubi', 'https://tubitv.com/'),
  web(510, 'PPV', 'ROKU', 'The Roku Channel', 'https://therokuchannel.roku.com/'),
  web(511, 'PPV', 'CRNC', 'Crunchyroll', 'https://www.crunchyroll.com/'),
  web(512, 'PPV', 'YTTV', 'YouTube TV', 'https://tv.youtube.com/'),
  web(513, 'PPV', 'APTV', 'Apple TV+', 'https://tv.apple.com/'),
  web(514, 'PPV', 'PLEX', 'Plex Free Movies', 'https://watch.plex.tv/'),
  web(515, 'PPV', 'KNPY', 'Kanopy', 'https://www.kanopy.com/'),
  web(516, 'PPV', 'CRIT', 'Criterion Channel', 'https://www.criterionchannel.com/'),
  web(517, 'PPV', 'SHUD', 'Shudder', 'https://www.shudder.com/'),
  web(518, 'PPV', 'TWCH', 'Twitch', 'https://www.twitch.tv/'),
  web(519, 'PPV', 'SPOT', 'Spotify', 'https://open.spotify.com/'),
];

// Local-area TV presets. 04240 = Lewiston/Auburn, Maine (Portland–Auburn market).
const AREA_PRESETS = {
  '04240': [
    { n: 6,  call: 'WCSH', name: 'WCSH 6 · NBC · NEWS CENTER Maine', net: 'NBC', url: 'https://www.newscentermaine.com/' },
    { n: 8,  call: 'WMTW', name: 'WMTW News 8 · ABC', net: 'ABC', url: 'https://www.wmtw.com/' },
    { n: 9,  call: 'WX9',  name: 'Local on the 9s · Weather', kind: 'weather' },
    { n: 10, call: 'WCBB', name: 'WCBB 10 · Maine Public', net: 'PBS', url: 'https://www.mainepublic.org/' },
    { n: 12, call: 'PINE', name: 'Pine Tree Past', kind: 'archive', q: [TS('maine', 'portland maine', 'lewiston', 'auburn maine', 'bangor')], desc: 'Old films and footage from around Maine.' },
    { n: 13, call: 'WGME', name: 'WGME CBS 13', net: 'CBS', url: 'https://wgme.com/' },
    { n: 21, call: 'GFTV', name: 'Great Falls TV (Auburn)', net: 'PEG', url: 'https://www.auburnmaine.gov/Pages/Great-Falls-TV/Great-Falls-TV' },
    { n: 23, call: 'WPFO', name: 'WPFO 23', net: 'IND', url: 'https://fox23maine.com/' },
    { n: 24, call: 'WPXT', name: 'WPXT · The CW (51)', net: 'CW', url: '' },
    { n: 25, call: 'WIPL', name: 'WIPL · ION (35)', net: 'ION', url: 'https://iontelevision.com/' },
    { n: 26, call: 'WMEA', name: 'WMEA 26 · Maine Public', net: 'PBS', url: 'https://www.mainepublic.org/' },
  ],
};

function areaChannels() {
  const preset = AREA_PRESETS[settings.zip] || [{ n: 9, call: 'WX9', name: 'Local on the 9s · Weather', kind: 'weather' }];
  const over = settings.localStations || {};
  const byNum = new Map(preset.map(p => [p.n, p]));
  for (const k of Object.keys(over)) byNum.set(+k, { ...(byNum.get(+k) || {}), ...over[k], n: +k });
  return SECTIONS[2].nums.map(n => {
    const p = byNum.get(n);
    if (!p) return { n, cat: 'LOCAL TV', call: 'OPEN', name: `Channel ${n} (open)`, kind: 'station', url: '', open: true };
    const kind = p.kind || (p.yt && p.yt.length ? 'yt' : 'station');
    return { cat: 'LOCAL TV', ...p, kind };
  });
}

function localMediaChannels() {
  return SECTIONS[0].nums.map(n => {
    const m = settings.localMap[n];
    return { n, cat: 'LOCAL MEDIA', call: m ? (m.call || 'LCL' + n) : 'LCL' + n, name: m ? m.label : `Local ${n} (not set up)`, kind: 'local', map: m || null };
  });
}

export let CHANNELS = [];
export function buildLineup() {
  const all = [
    ...localMediaChannels(),
    { n: 3, cat: 'GAMES', call: 'GAME', name: 'Game Channel', kind: 'games' },
    ...areaChannels(),
    ...NOSTALGIA, ...YOUTUBE, ...PODCASTS, ...MORE, ...PPV,
  ];
  const taken = new Map(all.map(c => [c.n, c]));
  for (const u of settings.userChannels) {
    const ch = { ...u, user: true };
    if (taken.has(u.n)) all.splice(all.indexOf(taken.get(u.n)), 1, ch); else all.push(ch);
    taken.set(u.n, ch);
  }
  all.sort((x, y) => x.n - y.n);
  CHANNELS = all;
  return all;
}
export const chanByNum = n => CHANNELS.find(c => c.n === n);
export const isHidden = n => settings.hidden.includes(n);
export const surfable = () => CHANNELS.filter(c => !isHidden(c.n));

export function nextFree(sectionId) {
  const s = SECTIONS.find(x => x.id === sectionId);
  for (let n = s.from; n <= s.to; n++) if (!chanByNum(n)) return n;
  return null;
}
// Call letters for a user channel: initials or first letters, max 4.
export function makeCall(name) {
  const w = String(name).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!w.length) return 'CH';
  return (w.length > 1 ? w.map(x => x[0]).join('') : w[0]).slice(0, 4);
}
export { TS, S, T };
