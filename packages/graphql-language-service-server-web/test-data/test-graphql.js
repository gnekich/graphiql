console.log("regular javascript file");

const doSomethingWithGraphQLString = (str) => {
  // Fetch Hasura/GraphQL API do your magic...
  return str;
};

const myQuery = doSomethingWithGraphQLString(/* GraphQL */ `
  query getNotes {
    notes {
      content
      subject
      id
    }
  }
  mutation deleteNodes {
    delete_notes(where: {}) {
      affected_rows
    }
  }
  mutation updateNote {
    insert_notes_one(
      object: { content: "Test Note", subject: "Lorem Ipsum..." }
    ) {
      id
      subject
      content
    }
  }
  subscription sub {
    notes {
      content
      subject
      id
    }
  }
`);

console.log("regular javascript test file...");
