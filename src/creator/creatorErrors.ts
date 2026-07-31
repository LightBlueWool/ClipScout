export class CreatorMalformedJsonError extends Error {
  constructor() {
    super("Creator AI response was malformed JSON.");
  }
}

export class CreatorValidationError extends Error {
  constructor() {
    super("Creator AI response failed validation.");
  }
}

export class CreatorEmptyResponseError extends Error {
  constructor() {
    super("Creator AI response was empty.");
  }
}
