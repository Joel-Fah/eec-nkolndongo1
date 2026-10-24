CREATE TABLE "bible_verses" (
	"translation" text NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "bible_verses_translation_book_chapter_verse_pk" PRIMARY KEY("translation","book","chapter","verse")
);
