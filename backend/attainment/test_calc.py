from .services.calculator import calculate_po_attainment

co_scores = {
    "CO1": 2.16,
    "CO2": 2.69,
    "CO3": 2.79,
    "CO4": 2.58,
}

mappings = {

    "CO1": {
        "PO1": 3,
        "PO2": 2,
        "PO3": 3,
        "PO4": 2,
    },

    "CO2": {
        "PO1": 3,
        "PO2": 3,
        "PO3": 3,
        "PO4": 2,
    },

    "CO3": {
        "PO1": 3,
        "PO2": 1,
        "PO3": 3,
        "PO4": 2,
    },

    "CO4": {
        "PO1": 3,
        "PO2": 3,
        "PO3": 3,
        "PO4": 2,
    },
}

if __name__ == "__main__":
    result = calculate_po_attainment(
        co_scores,
        mappings
    )
    print(result)
