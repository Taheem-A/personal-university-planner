# Source boundary

Product and architectural authority, in descending order:

1. The [Personal University Planning System](https://docs.google.com/document/d/181-WHJBjtYLUp0902dgDcVE4LhYMOyGDDOaEZespe-8) master specification.
2. The [University Planner — Implementation Roadmap](https://docs.google.com/document/d/1kxwNWaoMiWE9cbF2lFPEHQNK2oTYvTtFTqzU9wDl3qI).
3. Approved/frozen UI references supplied with the project and preserved in the repository.
4. Accepted repository ADRs and explicit architectural decisions.
5. Production implementation as evidence of present behavior.
6. Dated milestone/progress records as historical evidence.

The original preview used the master document and supplied mockups. Later production milestones also follow the roadmap and accepted ADRs. Official framework/library documentation may clarify technical behavior; it does not add product requirements or replace the approved visual references. Test/preview fixtures are isolated from production routes.

Where the generated mockups conflict with the written implementation contract, the document wins. In particular, decorative motivational filler present in some mockups is intentionally omitted because the frozen MVP interface contract rejects motivational filler and dashboard decoration.
