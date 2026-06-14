import Foundation

struct MetricDefinition: Codable, Identifiable, Hashable {
    var id: String { key }

    let key: String
    let label: String
    let metricType: String
    let category: String
    let inputWidget: String
    let minSampleSize: Int
    let enumValues: [String]?
    let minValue: Int?
    let maxValue: Int?

    enum CodingKeys: String, CodingKey {
        case key, label, category
        case metricType = "metric_type"
        case inputWidget = "input_widget"
        case minSampleSize = "min_sample_size"
        case enumValues = "enum_values"
        case minValue = "min_value"
        case maxValue = "max_value"
    }
}

struct AttributeAggregate: Codable, Hashable {
    let value: AttributeValue?
    let confidence: Double?
    let truePct: Double?
    let distribution: [String: Double]?

    enum CodingKeys: String, CodingKey {
        case value, confidence, distribution
        case truePct = "true_pct"
    }
}

enum AttributeValue: Codable, Hashable {
    case bool(Bool)
    case number(Double)
    case string(String)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .string(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

struct AttributeEntry: Codable, Identifiable, Hashable {
    var id: String { key }

    let key: String
    let label: String
    let category: String
    let metricType: String
    let sampleSize: Int
    let minSampleSize: Int
    let status: String
    let message: String?
    let aggregate: AttributeAggregate?

    enum CodingKeys: String, CodingKey {
        case key, label, category, status, message, aggregate
        case metricType = "metric_type"
        case sampleSize = "sample_size"
        case minSampleSize = "min_sample_size"
    }
}

struct AttributesResponse: Decodable {
    let attributes: [String: AttributeEntry]
}

struct AttributeSubmission: Encodable {
    let metricKey: String
    let value: AttributeSubmissionValue
    let visitContext: String?

    enum CodingKeys: String, CodingKey {
        case value
        case metricKey = "metric_key"
        case visitContext = "visit_context"
    }
}

enum AttributeSubmissionValue: Encodable {
    case bool(Bool)
    case number(Double)
    case string(String)

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .string(let value):
            try container.encode(value)
        }
    }
}

struct RestaurantNote: Codable, Identifiable, Hashable {
    let id: UUID
    let text: String
    let tags: [String]
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, text, tags
        case createdAt = "created_at"
    }
}

struct NotesResponse: Decodable {
    let notes: [RestaurantNote]
}

struct NoteSubmission: Encodable {
    let text: String
    let tags: [String]
}
