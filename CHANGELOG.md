# Changelog

## [Unreleased]
### Fixed
- Fixed routing issues for admin and blog pages (#1, #2)
- Moved blog routes before catch-all slug handler to prevent conflicts
- Fixed CMS route paths to prevent double /cms prefix causing HTTP 500
- Moved RSS route before slug catch-all to prevent 'rss.xml' being matched as slug
