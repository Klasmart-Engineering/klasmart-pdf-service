This directory contains PDF documents read during integration tests.

Most of the directories match the naming pattern of paths from CMS. While the service should be able to correctly resolve an arbitrary path part, the use of these directories should ensure that no regression happen that could affect the in-use pathnames.

Note: empty directory is intentionally left empty in order to test 404 errors. 